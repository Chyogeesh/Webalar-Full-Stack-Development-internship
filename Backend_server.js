const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Models
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});
const User = mongoose.model('User', UserSchema);

const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true, unique: true },
  description: String,
  assignedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['Todo', 'In Progress', 'Done'], default: 'Todo' },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  lastModified: { type: Date, default: Date.now },
  version: { type: Number, default: 1 },
});
const Task = mongoose.model('Task', TaskSchema);

const ActionLogSchema = new mongoose.Schema({
  action: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
  timestamp: { type: Date, default: Date.now },
});
const ActionLog = mongoose.model('ActionLog', ActionLogSchema);

// Middleware
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Routes
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Missing fields' });
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const user = new User({ username, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: 'User registered' });
  } catch (err) {
    res.status(400).json({ message: 'Username taken' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

app.get('/api/users', authMiddleware, async (req, res) => {
  const users = await User.find().select('username _id');
  res.json(users);
});

app.get('/api/tasks', authMiddleware, async (req, res) => {
  const tasks = await Task.find().populate('assignedUser', 'username');
  res.json(tasks);
});

app.post('/api/tasks', authMiddleware, async (req, res) => {
  const { title, description, priority } = req.body;
  if (['Todo', 'In Progress', 'Done'].includes(title)) {
    return res.status(400).json({ message: 'Title cannot match column names' });
  }
  try {
    const task = new Task({ title, description, priority, assignedUser: req.user.id });
    await task.save();
    await new ActionLog({ action: 'Created task', user: req.user.id, task: task._id }).save();
    io.emit('taskUpdate', { task, action: 'create' });
    res.status(201).json(task);
  } catch (err) {
    res.status(400).json({ message: 'Task title must be unique' });
  }
});

app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { title, description, status, priority, version } = req.body;
  const task = await Task.findById(id);
  if (!task) return res.status(404).json({ message: 'Task not found' });
  if (task.version !== version) {
    return res.status(409).json({
      message: 'Conflict detected',
      current: task,
      proposed: { title, description, status, priority },
    });
  }
  task.title = title || task.title;
  task.description = description || task.description;
  task.status = status || task.status;
  task.priority = priority || task.priority;
  task.version += 1;
  task.lastModified = Date.now();
  await task.save();
  await new ActionLog({ action: `Updated task: ${title}`, user: req.user.id, task: id }).save();
  io.emit('taskUpdate', { task, action: 'update' });
  res.json(task);
});

app.post('/api/tasks/:id/resolve-conflict', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { merge, title, description, status, priority } = req.body;
  const task = await Task.findById(id);
  if (!task) return res.status(404).json({ message: 'Task not found' });
  task.title = title;
  task.description = description;
  task.status = status;
  task.priority = priority;
  task.version += 1;
  task.lastModified = Date.now();
  await task.save();
  await new ActionLog({ action: `Resolved conflict for task: ${title}`, user: req.user.id, task: id }).save();
  io.emit('taskUpdate', { task, action: 'resolve' });
  res.json(task);
});

app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const task = await Task.findByIdAndDelete(id);
  if (!task) return res.status(404).json({ message: 'Task not found' });
  await new ActionLog({ action: `Deleted task: ${task.title}`, user: req.user.id, task: id }).save();
  io.emit('taskUpdate', { task, action: 'delete' });
  res.json({ message: 'Task deleted' });
});

app.post('/api/tasks/:id/smart-assign', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const task = await Task.findById(id);
  if (!task) return res.status(404).json({ message: 'Task not found' });
  const users = await User.find();
  const taskCounts = await Task.aggregate([
    { $match: { status: { $in: ['Todo', 'In Progress'] } } },
    { $group: { _id: '$assignedUser', count: { $sum: 1 } } },
  ]);
  let minTasks = Infinity;
  let selectedUser = null;
  users.forEach(user => {
    const count = taskCounts.find(tc => tc._id?.toString() === user._id.toString())?.count || 0;
    if (count < minTasks) {
      minTasks = count;
      selectedUser = user;
    }
  });
  task.assignedUser = selectedUser._id;
  task.version += 1;
  await task.save();
  await new ActionLog({ action: `Smart assigned task: ${task.title}`, user: req.user.id, task: id }).save();
  io.emit('taskUpdate', { task, action: 'smart-assign' });
  res.json(task);
});

app.get('/api/actions', authMiddleware, async (req, res) => {
  const actions = await ActionLog.find()
    .sort({ timestamp: -1 })
    .limit(20)
    .populate('user', 'username')
    .populate('task', 'title');
  res.json(actions);
});

// Socket.IO
io.on('connection', socket => {
  console.log('User connected:', socket.id);
  socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
