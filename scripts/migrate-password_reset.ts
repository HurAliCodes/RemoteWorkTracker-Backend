import { withDatabase } from './utils/db';
export default async function resetPasswordResetsTable() {
  await withDatabase(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        user_id UUID REFERENCES users(user_id) ON DELETE CASCADE UNIQUE,
        reset_token VARCHAR(12) PRIMARY KEY,
        expires_at TIMESTAMP NOT NULL
      );
    `);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE table_name='password_resets' AND constraint_type='UNIQUE' AND constraint_name='unique_user_id') THEN
          ALTER TABLE password_resets ADD CONSTRAINT unique_user_id UNIQUE (user_id);
        END IF;
      END$$;
    `);
    console.log('password_resets table created or already exists, and unique constraint ensured.');
  });
}
