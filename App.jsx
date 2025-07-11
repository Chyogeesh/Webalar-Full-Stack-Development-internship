import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import io from 'socket.io-client';
import axios from 'axios';

const socket = io('http://localhost:5000');

function App() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState({ Todo: [], 'In Progress': [], Done: [] });
  const [actions, setActions] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'Medium' });
  const [conflict, setConflict] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchTasks();
      fetchActions();
    }
    socket.on('taskUpdate', ({ task, action }) => {
      fetchTasks();
      fetchActions();
    });
    return () => socket.off('taskUpdate');
  }, []);

  const fetchTasks = async () => {
    const res = await axios.get('/api/tasks');
    const tasksByStatus = { Todo: [], 'In Progress': [], Done: [] };
    res.data.forEach(task => tasksByStatus[task.status].push(task));
    setTasks(tasksByStatus);
  };

  const fetchActions = async () => {
    const res = await axios.get('/api/actions');
    setActions(res.data);
  };

  const handleLogin = async e => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/login', { username, password });
      localStorage.setItem('token', res.data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
      setUser({ username });
      fetchTasks();
      fetchActions();
    } catch (err) {
      alert(err.response.data.message);
    }
  };

  const handleRegister = async e => {
    e.preventDefault();
    try {
      await axios.post('/api/register', { username, password });
      alert('Registered successfully. Please log in.');
    } catch (err) {
      alert(err.response.data.message);
    }
  };

  const handleAddTask = async e => {
    e.preventDefault();
    try {
      await axios.post('/api/tasks', newTask);
      setNewTask({ title: '', description: '', priority: 'Medium' });
    } catch (err) {
      alert(err.response.data.message);
    }
  };

  const handleUpdateTask = async (task, updates) => {
    try {
      await axios.put(`/api/tasks/${task._id}`, { ...updates, version: task.version });
    } catch (err) {
      if (err.response.status === 409) {
        setConflict({ taskId: task._id, current: err.response.data.current, proposed: err.response.data.proposed });
      } else {
        alert(err.response.data.message);
      }
    }
  };

  const handleResolveConflict = async (merge, values) => {
    await axios.post(`/api/tasks/${conflict.taskId}/resolve-conflict`, { merge, ...values });
    setConflict(null);
  };

  const handleSmartAssign = async taskId => {
    await axios.post(`/api/tasks/${taskId}/smart-assign`);
  };

  const onDragEnd = async result => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    const task = tasks[source.droppableId].find(t => t._id === draggableId);
    if (source.droppableId !== destination.droppableId) {
      handleUpdateTask(task, { status: destination.droppableId });
    }
  };

  if (!user) {
    return (
      <div className="container">
        <h1>Collaborative To-Do Board</h1>
        <div className="auth">
          <h2>Login</h2>
          <form onSubmit={handleLogin}>
            <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
            <button type="submit">Login</button>
          </form>
          <h2>Register</h2>
          <form onSubmit={handleRegister}>
            <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
            <button type="submit">Register</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Collaborative To-Do Board</h1>
      <button onClick={() => { localStorage.removeItem('token'); setUser(null); }}>Logout</button>
      <form onSubmit={handleAddTask}>
        <input
          type="text"
          placeholder="Task Title"
          value={newTask.title}
          onChange={e => setNewTask({ ...newTask, title: e.target.value })}
        />
        <input
          type="text"
          placeholder="Description"
          value={newTask.description}
          onChange={e => setNewTask({ ...newTask, description: e.target.value })}
        />
        <select
          value={newTask.priority}
          onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
        >
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>
        <button type="submit">Add Task</button>
      </form>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="board">
          {Object.keys(tasks).map(status => (
            <Droppable droppableId={status} key={status}>
              {provided => (
                <div className="column" ref={provided.innerRef} {...provided.droppableProps}>
                  <h2>{status}</h2>
                  {tasks[status].map((task, index) => (
                    <Draggable key={task._id} draggableId={task._id} index={index}>
                      {provided => (
                        <div
                          className="task"
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          <h3>{task.title}</h3>
                          <p>{task.description}</p>
                          <p>Priority: {task.priority}</p>
                          <p>Assigned: {task.assignedUser?.username || 'Unassigned'}</p>
                          <button onClick={() => handleSmartAssign(task._id)}>Smart Assign</button>
                          <button onClick={() => axios.delete(`/api/tasks/${task._id}`)}>Delete</button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
      <div className="actions">
        <h2>Activity Log</h2>
        <ul>
          {actions.map(action => (
            <li key={action._id}>
              {action.user?.username} {action.action} at {new Date(action.timestamp).toLocaleString()}
            </li>
          ))}
        </ul>
      </div>
      {conflict && (
        <div className="conflict">
          <h2>Conflict Detected</h2>
          <p>Current: {conflict.current.title} - {conflict.current.description}</p>
          <p>Proposed: {conflict.proposed.title} - {conflict.proposed.description}</p>
          <button onClick={() => handleResolveConflict(true, conflict.proposed)}>Merge</button>
          <button onClick={() => handleResolveConflict(false, conflict.proposed)}>Overwrite</button>
        </div>
      )}
    </div>
  );
}

export default App;
