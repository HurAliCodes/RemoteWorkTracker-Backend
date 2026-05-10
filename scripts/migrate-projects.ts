import { withDatabase } from './utils/db';
export default async function migrateProjects() {
    await withDatabase(async (client) => {
        await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
        await client.query(`
            CREATE TABLE IF NOT EXISTS projects (
                project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL,
                description VARCHAR(500),
                manager_id UUID NOT NULL,
                organization_id UUID NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_manager FOREIGN KEY(manager_id) REFERENCES users(user_id),
                CONSTRAINT fk_organization FOREIGN KEY(organization_id) REFERENCES organizations(organization_id)
            );
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_projects_manager_id ON projects(manager_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_projects_start_date ON projects(start_date)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_projects_end_date ON projects(end_date)');
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
                    SELECT 1 FROM pg_trigger WHERE tgname = 'update_projects_updated_at'
                ) THEN
                    CREATE TRIGGER update_projects_updated_at
                    BEFORE UPDATE ON projects
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                END IF;
            END;
            $$;
        `);
        console.log('Projects table migrated successfully with auto-updating updated_at.');
    });
}