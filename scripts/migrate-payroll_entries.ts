import { withDatabase } from './utils/db';
export default async function migratePayrollEntries() {
    await withDatabase(async (client) => {
        await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

        await client.query(`
            CREATE TABLE IF NOT EXISTS payroll_entries (
                entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                payroll_id UUID NOT NULL,
                description VARCHAR(255),
                amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_payroll FOREIGN KEY(payroll_id) REFERENCES payroll(payroll_id)
            );
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_payroll_entries_payroll_id ON payroll_entries(payroll_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_payroll_entries_created_at ON payroll_entries(created_at)');
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
                    SELECT 1 FROM pg_trigger WHERE tgname = 'update_payroll_entries_updated_at'
                ) THEN
                    CREATE TRIGGER update_payroll_entries_updated_at
                    BEFORE UPDATE ON payroll_entries
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                END IF;
            END;
            $$;
        `);
        console.log('Payroll entries table migrated successfully with auto-updating updated_at.');
    });
}