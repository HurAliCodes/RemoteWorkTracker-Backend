import { Server } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { setupRabbitMQ } from './rabbitmq';
import { ENV } from '../config/env';

const JWT_SECRET = ENV.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('[ws] JWT_SECRET is not set; WebSocket auth will reject all connections');
}

export function setupWebSocketServer(server: http.Server) {
  const allowedOrigin = ENV.CORS_ORIGIN || ENV.FRONTEND_URL || 'http://localhost:3000';
  const origins = allowedOrigin.split(',').map((s) => s.trim()).filter(Boolean);
  const io = new Server(server, {
    cors: {
      origin: origins.length ? origins : false,
      methods: ['GET', 'POST'],
    },
  });
  const pubClient = createClient({ url: ENV.REDIS_URL || 'redis://localhost:6379' });
  const subClient = pubClient.duplicate();
  Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
  }).catch((err) => {
    console.warn('[ws] Redis adapter unavailable', err);
  });
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token || !JWT_SECRET) return next(new Error('Authentication error'));
    try {
      const payload = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
      (socket as any).user = payload;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });
  setupRabbitMQ(io);
  io.on('connection', (socket) => {
    const user = (socket as any).user;
    if (!user) return;
    const userKey = (user.userId || user.id || user.organizationId) as string | undefined;
    if (userKey) {
      socket.join(`user:${userKey}`);
    }
    socket.on('join:project', (projectId: string) => {
      // Membership checks should be enforced by the API that authorizes the client;
      // room join is scoped to authenticated sockets only.
      if (typeof projectId === 'string' && projectId.trim()) {
        socket.join(`project:${projectId}`);
      }
    });
    socket.on('disconnect', () => {});
  });

  return io;
}
