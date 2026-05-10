import { withDatabase } from './utils/db';
export default async function migrateGoals() {
    await withDatabase(async (client) => {
        await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
        await client.query(`
            CREATE TABLE IF NOT EXISTS goals (
                goal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                progress INTEGER DEFAULT 0,
                deadline DATE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(user_id)
            );
        `);
        await client.query('ALTER TABLE goals ADD COLUMN IF NOT EXISTS progress INTEGER');
        await client.query('ALTER TABLE goals ADD COLUMN IF NOT EXISTS deadline DATE');
        await client.query('UPDATE goals SET progress = 0 WHERE progress IS NULL');
        await client.query('ALTER TABLE goals ALTER COLUMN progress SET DEFAULT 0');
        await client.query('ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_progress_range_check');
        await client.query('ALTER TABLE goals ADD CONSTRAINT goals_progress_range_check CHECK (progress >= 0 AND progress <= 100)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_goals_created_at ON goals(created_at)');
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
                    SELECT 1 FROM pg_trigger WHERE tgname = 'update_goals_updated_at'
                ) THEN
                    CREATE TRIGGER update_goals_updated_at
                    BEFORE UPDATE ON goals
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                END IF;
            END;
            $$;
        `);
        console.log('Goals table migrated successfully with auto-updating updated_at.');
    });
}