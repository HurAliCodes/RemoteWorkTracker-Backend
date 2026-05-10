import { Server } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { setupRabbitMQ } from './rabbitmq';
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
export function setupWebSocketServer(server: http.Server) {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });
  const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  const subClient = pubClient.duplicate();
  Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
  });
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      (socket as any).user = payload;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });
  // Start RabbitMQ consumer
  setupRabbitMQ(io);
  io.on('connection', (socket) => {
    const user = (socket as any).user;
    if (!user) return;
    // Join user-specific room
    socket.join(`user:${user.id}`);
    // Optionally join project rooms (client should emit 'join:project' with projectId)
    socket.on('join:project', (projectId: string) => {
      socket.join(`project:${projectId}`);
    });
    // Handle disconnect
    socket.on('disconnect', () => {});
  });

  return io;
}
