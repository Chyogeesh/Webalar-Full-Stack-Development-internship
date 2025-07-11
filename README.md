# Webalar-Full-Stack-Development-internship
It is an internship assignment
Collaborative To-Do Board
Project Overview
This is a full-stack web-based collaborative to-do board application, built to meet the requirements of the Internshala Full Stack Coding Assignment. It allows multiple users to manage tasks in real-time with a Kanban-style board, featuring secure authentication, real-time sync, smart assign logic, and conflict handling. The app is built using the MERN stack (MongoDB, Express.js, React, Node.js) with Socket.IO for real-time updates and custom CSS for styling.
Tech Stack

Frontend: React, react-beautiful-dnd (for drag-and-drop), Socket.IO client, Axios, custom CSS.
Backend: Node.js, Express.js, MongoDB (Mongoose), Socket.IO, JWT, bcrypt.
Deployment: Frontend (Vercel), Backend (Render), MongoDB (MongoDB Atlas).

Setup and Installation
Prerequisites

Node.js (v16 or higher)
MongoDB (local or MongoDB Atlas)
Git

Backend Setup

Clone the repository:git clone <your-repo-url>
cd todo-board/backend


Install dependencies:npm install


Create a .env file in the backend directory based on .env.example:MONGO_URI=mongodb://localhost:27017/todo_board
JWT_SECRET=your_jwt_secret_here


Start the backend server:node server.js



Frontend Setup

Navigate to the frontend directory:cd ../frontend


Install dependencies:npm install


Start the frontend development server:npm start


Open http://localhost:3000 in your browser.

Deployment

Frontend: Deployed on Vercel:
Push the frontend folder to a GitHub repository.
Connect to Vercel, select the repository, and deploy.


Backend: Deployed on Render:
Push the backend folder to a GitHub repository.
Connect to Render, set environment variables (MONGO_URI, JWT_SECRET), and deploy.


MongoDB: Use MongoDB Atlas for a cloud database. Update MONGO_URI in the backend .env.

Features and Usage

Login/Register: Users can sign up or log in with a username and password. JWT tokens are stored in localStorage.
Kanban Board: Three columns (Todo, In Progress, Done) with drag-and-drop tasks. Tasks include title, description, priority, and assigned user.
Real-Time Sync: Task changes (add, edit, delete, drag, assign) are broadcast to all users via Socket.IO.
Smart Assign: A button on each task assigns it to the user with the fewest active tasks (Todo/In Progress).
Conflict Handling: If two users edit the same task simultaneously, a conflict modal shows both versions, allowing merge or overwrite.
Activity Log: Displays the last 20 actions (e.g., "UserX created task Y") in real-time.
Custom Animation: Tasks rotate slightly during drag-and-drop for a smooth effect.
Responsive Design: Works on desktop and mobile with a flexible layout.

Smart Assign Logic
The "Smart Assign" feature assigns a task to the user with the fewest active tasks (in Todo or In Progress). The backend queries all users and counts their tasks in these statuses using MongoDB aggregation. The user with the lowest count is assigned the task, and the action is logged.
Conflict Handling Logic
When two users edit a task simultaneously, the backend checks the task’s version number. If a conflict occurs (version mismatch), the server returns both the current and proposed versions. The frontend displays a modal with both versions, allowing the user to merge (combine fields manually) or overwrite (use the proposed version). The resolved task increments the version and logs the action.
Live Demo

Deployed App URL: [Insert Vercel/Render URL after deployment]
Demo Video: [Insert Loom/YouTube link after recording]

Notes

Ensure MongoDB is running locally or use MongoDB Atlas.
The backend runs on port 5000 by default; update the frontend Socket.IO and Axios base URL if deployed elsewhere.
The drag-and-drop animation uses react-beautiful-dnd for simplicity, with custom CSS for visual flair.
No third-party CSS frameworks (e.g., Bootstrap) are used, as per requirements.

For issues or feedback, refer to the GitHub repository or contact the developer.
