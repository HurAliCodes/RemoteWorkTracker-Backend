import { withDatabase } from './utils/db';
export default async function migratePerformanceReviews() {
    await withDatabase(async (client) => {
        await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
        await client.query(`
            CREATE TABLE IF NOT EXISTS performance_reviews (
                review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                reviewer_id UUID,
                score NUMERIC(5,2),
                comments TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(user_id)
            );
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_performance_reviews_user_id ON performance_reviews(user_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_performance_reviews_created_at ON performance_reviews(created_at)');
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
                    SELECT 1 FROM pg_trigger WHERE tgname = 'update_performance_reviews_updated_at'
                ) THEN
                    CREATE TRIGGER update_performance_reviews_updated_at
                    BEFORE UPDATE ON performance_reviews
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                END IF;
            END;
            $$;
        `);
        console.log('Performance reviews table migrated successfully with auto-updating updated_at.');
    });
}