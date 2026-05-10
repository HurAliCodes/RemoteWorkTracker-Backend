import amqp from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const QUEUE = 'task_events';
const AI_QUEUE = 'ai_events';


export async function publishTaskEvent(event: { type: string; userId?: string; projectId?: string; data: any }) {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue(QUEUE, { durable: true });
  await channel.sendToQueue(QUEUE, Buffer.from(JSON.stringify(event)), { persistent: true });
  await channel.close();
  await connection.close();
}

// Alias for project events (reuse the same queue for now)
export const publishProjectEvent = publishTaskEvent;

export async function publishAiEvent(event: { type: string; tenantId: string; requestId: string; data: any }) {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue(AI_QUEUE, { durable: true });
  await channel.sendToQueue(AI_QUEUE, Buffer.from(JSON.stringify(event)), { persistent: true });
  await channel.close();
  await connection.close();
}
