// server/index.js
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import registerSocketEvents from './events.js'; // optional, depending on your setup

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

registerSocketEvents(io); // socket.io handlers (if you have them)

const PORT = process.env.PORT || 4000;
const isDev = process.env.NODE_ENV === 'development';

// ✅ In production, serve the React frontend
if (!isDev) {
  // This resolves to `dist/` folder bundled with your Electron app
  const frontendPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(frontendPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
