import { withDatabase } from './utils/db';

export default async function migrateTaskComments() {
  await withDatabase(async (client) => {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS task_comments (
        comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL,
        user_id UUID NOT NULL,
        comment TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_task FOREIGN KEY(task_id) REFERENCES tasks(task_id),
        CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(user_id)
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON task_comments(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON task_comments(created_at)');
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
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_task_comments_updated_at'
        ) THEN
          CREATE TRIGGER update_task_comments_updated_at
          BEFORE UPDATE ON task_comments
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END;
      $$;
    `);
    console.log('Task comments table migrated successfully with auto-updating updated_at.');
  });
}