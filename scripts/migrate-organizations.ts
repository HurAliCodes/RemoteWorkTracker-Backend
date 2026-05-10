import { withDatabase } from './utils/db';
export default async function migrateOrganizations() {
    await withDatabase(async (client) => {
        await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
        await client.query(`
            CREATE TABLE IF NOT EXISTS organizations (
                organization_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) UNIQUE NOT NULL,
                organization_type VARCHAR(50),
                address TEXT,
                admin_email VARCHAR(100) UNIQUE NOT NULL,
                admin_password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        
        await client.query(`
            ALTER TABLE organizations
            ADD COLUMN IF NOT EXISTS admin_email VARCHAR(100),
            ADD COLUMN IF NOT EXISTS admin_password_hash VARCHAR(255);
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_organizations_admin_email ON organizations(admin_email)');
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
                    SELECT 1 FROM pg_trigger WHERE tgname = 'update_organizations_updated_at'
                ) THEN
                    CREATE TRIGGER update_organizations_updated_at
                    BEFORE UPDATE ON organizations
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                END IF;
            END;
            $$;
        `);
        console.log('Organizations table migrated successfully with admin fields and auto-updating updated_at.');
    });
}