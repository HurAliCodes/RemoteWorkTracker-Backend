import { withDatabase } from './utils/db';
export default async function migrateCourseEnrollments() {
    await withDatabase(async (client) => {
        await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
        await client.query(`
            CREATE TABLE IF NOT EXISTS course_enrollments (
                enrollment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                course_id UUID NOT NULL,
                user_id UUID NOT NULL,
                status VARCHAR(50) NOT NULL,
                progress NUMERIC(5,2),
                completed_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_course FOREIGN KEY(course_id) REFERENCES courses(course_id),
                CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(user_id)
            );
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_course_enrollments_course_id ON course_enrollments(course_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_course_enrollments_user_id ON course_enrollments(user_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_course_enrollments_created_at ON course_enrollments(created_at)');
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
                    SELECT 1 FROM pg_trigger WHERE tgname = 'update_course_enrollments_updated_at'
                ) THEN
                    CREATE TRIGGER update_course_enrollments_updated_at
                    BEFORE UPDATE ON course_enrollments
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                END IF;
            END;
            $$;
        `);
        console.log('Course enrollments table migrated successfully with auto-updating updated_at.');
    });
}