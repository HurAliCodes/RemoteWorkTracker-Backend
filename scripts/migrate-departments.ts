import { withDatabase } from './utils/db';
export default async function migrateDepartments() {
    await withDatabase(async (client) => {
        await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
        await client.query(`
            CREATE TABLE IF NOT EXISTS departments (
                department_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL,
                organization_id UUID NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_organization FOREIGN KEY(organization_id) REFERENCES organizations(organization_id)
            );
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_departments_organization_id ON departments(organization_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name)');
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
                    SELECT 1 FROM pg_trigger WHERE tgname = 'update_departments_updated_at'
                ) THEN
                    CREATE TRIGGER update_departments_updated_at
                    BEFORE UPDATE ON departments
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                END IF;
            END;
            $$;
        `);
        console.log('Departments table migrated successfully with auto-updating updated_at.');
    });
}