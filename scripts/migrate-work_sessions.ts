import { withDatabase } from './utils/db';
export default async function migrateWorkSessions() {
  await withDatabase(async (client) => {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS work_sessions (
        session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        project_id UUID,
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(user_id),
        CONSTRAINT fk_project FOREIGN KEY(project_id) REFERENCES projects(project_id)
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_work_sessions_user_id ON work_sessions(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_work_sessions_project_id ON work_sessions(project_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_work_sessions_created_at ON work_sessions(created_at)');
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
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_work_sessions_updated_at'
        ) THEN
          CREATE TRIGGER update_work_sessions_updated_at
          BEFORE UPDATE ON work_sessions
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END;
      $$;
    `);
    console.log('Work sessions table migrated successfully with auto-updating updated_at.');
  });
}