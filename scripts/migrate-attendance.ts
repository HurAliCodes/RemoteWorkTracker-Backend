import { withDatabase } from './utils/db';
export default async function migrateAttendance() {
    await withDatabase(async (client) => {
        await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
        await client.query(`
            CREATE TABLE IF NOT EXISTS attendance (
                attendance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                device_id UUID,
                check_in TIMESTAMPTZ NOT NULL,
                check_out TIMESTAMPTZ,
                location VARCHAR(255),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(user_id),
                CONSTRAINT fk_device FOREIGN KEY(device_id) REFERENCES devices(device_id)
            );
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_attendance_created_at ON attendance(created_at)');
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
                    SELECT 1 FROM pg_trigger WHERE tgname = 'update_attendance_updated_at'
                ) THEN
                    CREATE TRIGGER update_attendance_updated_at
                    BEFORE UPDATE ON attendance
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                END IF;
            END;
            $$;
        `);
        console.log('Attendance table migrated successfully with auto-updating updated_at.');
    });
}