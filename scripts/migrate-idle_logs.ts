import { withDatabase } from './utils/db';

export default async function migrateIdleLogs() {
  await withDatabase(async (client) => {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS idle_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id UUID NOT NULL,
        user_id UUID NOT NULL,
        idle_time INTEGER NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        CONSTRAINT fk_idle_logs_user FOREIGN KEY (user_id) REFERENCES users(user_id)
      );
    `);
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_idle_logs_device_id ON idle_logs(device_id)'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_idle_logs_user_id ON idle_logs(user_id)'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_idle_logs_timestamp ON idle_logs(timestamp)'
    );
    console.log('Idle logs table migrated successfully.');
  });
}
