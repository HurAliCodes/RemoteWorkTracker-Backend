import { withDatabase } from './utils/db';
export default async function migrateDevices() {
  await withDatabase(async (client) => {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS devices (
        device_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        os VARCHAR(100) NOT NULL,
        hostname VARCHAR(255) NOT NULL,
        registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT TRUE,
        CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(user_id)
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_devices_hostname ON devices(hostname)');
    console.log('Devices table migrated successfully.');
  });
}
