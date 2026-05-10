import amqp from 'amqplib';
import { Server } from 'socket.io';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
export async function setupRabbitMQ(io: Server) {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    const queue = 'task_events';
    await channel.assertQueue(queue, { durable: true });
    channel.consume(queue, (msg: amqp.ConsumeMessage | null) => {
      if (msg) {
        try {
          const event = JSON.parse(msg.content.toString());
          // event: { type, userId, projectId, data }
          if (event.type && event.userId) {
            io.to(`user:${event.userId}`).emit(event.type, event.data);
          }
          if (event.type && event.projectId) {
            io.to(`project:${event.projectId}`).emit(event.type, event.data);
          }
        } catch (err) {
          console.error('Failed to process event:', err);
        }
        channel.ack(msg);
      }
    });
    console.log('RabbitMQ consumer started for task_events');
  } catch (err) {
    console.error('RabbitMQ connection error:', err);
  }
}
