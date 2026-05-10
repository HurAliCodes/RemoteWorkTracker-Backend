import { withDatabase } from './utils/db';
export default async function migrateComplianceRules() {
    await withDatabase(async (client) => {
        await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

        await client.query(`
            CREATE TABLE IF NOT EXISTS compliance_rules (
                rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                description VARCHAR(255) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_compliance_rules_created_at ON compliance_rules(created_at)');
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
                    SELECT 1 FROM pg_trigger WHERE tgname = 'update_compliance_rules_updated_at'
                ) THEN
                    CREATE TRIGGER update_compliance_rules_updated_at
                    BEFORE UPDATE ON compliance_rules
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                END IF;
            END;
            $$;
        `);

        console.log('Compliance rules table migrated successfully with auto-updating updated_at.');
    });
}