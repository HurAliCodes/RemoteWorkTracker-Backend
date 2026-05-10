import { withDatabase } from './utils/db';
export default async function migrateWellnessLogs() {
  await withDatabase(async (client) => {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS wellness_logs (
        log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        date DATE NOT NULL,
        mood VARCHAR(50),
        energy_level INTEGER,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(user_id)
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_wellness_logs_user_id ON wellness_logs(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_wellness_logs_date ON wellness_logs(date)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_wellness_logs_created_at ON wellness_logs(created_at)');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE 'plpgsql';
    `);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_wellness_logs_updated_at'
        ) THEN
          CREATE TRIGGER update_wellness_logs_updated_at
          BEFORE UPDATE ON wellness_logs
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END;
      $$;
    `);
    console.log('Wellness logs table migrated successfully with auto-updating updated_at.');
  });
}