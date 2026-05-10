import { withDatabase } from './utils/db';
export default async function migrateActivityLogs() {
	await withDatabase(async (client) => {
		await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
		   await client.query(`
			   CREATE TABLE IF NOT EXISTS activity_logs (
				   log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				   user_id UUID NOT NULL,
				   device_id UUID NOT NULL,
				   action VARCHAR(100) NOT NULL,
				   description TEXT,
				   ip_address VARCHAR(45),
				   device VARCHAR(100),
				   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				   CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(user_id)
			   );
		   `);
		await client.query('CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id)');
		await client.query('CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at)');
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
					SELECT 1 FROM pg_trigger WHERE tgname = 'update_activity_logs_updated_at'
				) THEN
					CREATE TRIGGER update_activity_logs_updated_at
					BEFORE UPDATE ON activity_logs
					FOR EACH ROW
					EXECUTE FUNCTION update_updated_at_column();
				END IF;
			END;
			$$;
		`);
		console.log('Activity logs table migrated successfully with auto-updating updated_at.');
	});
}