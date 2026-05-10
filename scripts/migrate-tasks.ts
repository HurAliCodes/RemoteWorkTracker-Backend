import { withDatabase } from './utils/db';
export default async function migrateTasks() {
  await withDatabase(async (client) => {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL,
        assigned_to UUID NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50),
        priority VARCHAR(50),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_project FOREIGN KEY(project_id) REFERENCES projects(project_id),
        CONSTRAINT fk_user FOREIGN KEY(assigned_to) REFERENCES users(user_id)
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at)');
    await client.query(`
      DO $deadline$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'deadline'
        ) THEN
          ALTER TABLE tasks ADD COLUMN deadline DATE;
        END IF;
      END;
      $deadline$;
    `);
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
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_tasks_updated_at'
        ) THEN
          CREATE TRIGGER update_tasks_updated_at
          BEFORE UPDATE ON tasks
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END;
      $$;
    `);
    console.log('Tasks table migrated successfully with auto-updating updated_at.');
  });
}