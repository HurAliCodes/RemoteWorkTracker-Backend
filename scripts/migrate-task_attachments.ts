import { withDatabase } from './utils/db';
export default async function migrateTaskAttachments() {
  await withDatabase(async (client) => {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_attachments (
        attachment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_task FOREIGN KEY(task_id) REFERENCES tasks(task_id)
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_task_attachments_created_at ON task_attachments(created_at)');
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
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_task_attachments_updated_at'
        ) THEN
          CREATE TRIGGER update_task_attachments_updated_at
          BEFORE UPDATE ON task_attachments
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END;
      $$;
    `);
    console.log('Task attachments table migrated successfully with auto-updating updated_at.');
  });
}