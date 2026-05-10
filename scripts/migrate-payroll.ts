import { withDatabase } from './utils/db';
export default async function migratePayroll() {
    await withDatabase(async (client) => {
        await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
        await client.query(`
            CREATE TABLE IF NOT EXISTS payroll (
                payroll_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                period_start DATE NOT NULL,
                period_end DATE NOT NULL,
                amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(user_id)
            );
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_payroll_user_id ON payroll(user_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_payroll_created_at ON payroll(created_at)');
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
                    SELECT 1 FROM pg_trigger WHERE tgname = 'update_payroll_updated_at'
                ) THEN
                    CREATE TRIGGER update_payroll_updated_at
                    BEFORE UPDATE ON payroll
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                END IF;
            END;
            $$;
        `);
        console.log('Payroll table migrated successfully with auto-updating updated_at.');
    });
}