import { withDatabase } from './utils/db';
export default async function migrateProjectMembers() {
    await withDatabase(async (client) => {
        await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
        await client.query(`
            CREATE TABLE IF NOT EXISTS project_members (
                member_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID NOT NULL,
                user_id UUID NOT NULL,
                role VARCHAR(100),
                joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_project FOREIGN KEY(project_id) REFERENCES projects(project_id),
                CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(user_id)
            );
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_project_members_created_at ON project_members(created_at)');
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
                    SELECT 1 FROM pg_trigger WHERE tgname = 'update_project_members_updated_at'
                ) THEN
                    CREATE TRIGGER update_project_members_updated_at
                    BEFORE UPDATE ON project_members
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                END IF;
            END;
            $$;
        `);
        console.log('Project members table migrated successfully with auto-updating updated_at.');
    });
}