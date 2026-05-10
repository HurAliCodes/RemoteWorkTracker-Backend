import http from 'http';
import app from '../app';
import { setupWebSocketServer } from './server';
const port = process.env.WS_PORT || 4001;
const server = http.createServer(app);
setupWebSocketServer(server);
server.listen(port, () => {
  console.log(`WebSocket server listening on port ${port}`);
});
