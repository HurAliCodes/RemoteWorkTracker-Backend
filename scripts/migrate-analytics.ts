import { withDatabase } from './utils/db';
export default async function migrateAnalytics() {
  await withDatabase(async (client) => {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_results (
        analytics_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        date DATE NOT NULL,
        productivity_score NUMERIC(5,2),
        burnout_alert BOOLEAN,
        task_delay_prediction BOOLEAN,
        workload_recommendation TEXT,
        raw_input JSONB,
        ai_output JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(user_id)
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_analytics_results_user_id ON analytics_results(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_analytics_results_date ON analytics_results(date)');
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
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_analytics_results_updated_at'
        ) THEN
          CREATE TRIGGER update_analytics_results_updated_at
          BEFORE UPDATE ON analytics_results
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END;
      $$;
    `);
    console.log('Analytics results table migrated successfully with auto-updating updated_at.');
  });
}
