import { withDatabase } from './utils/db';

export default async function migrateDevicePairingCodes() {
  await withDatabase(async (client) => {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS device_pairing_codes (
        pairing_code_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(32) NOT NULL UNIQUE,
        user_id UUID NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_device_pairing_user FOREIGN KEY(user_id) REFERENCES users(user_id)
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_device_pairing_codes_code ON device_pairing_codes(code)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_device_pairing_codes_user_id ON device_pairing_codes(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_device_pairing_codes_expires_at ON device_pairing_codes(expires_at)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_device_pairing_codes_consumed_at ON device_pairing_codes(consumed_at)');
    console.log('Device pairing codes table migrated successfully.');
  });
}
