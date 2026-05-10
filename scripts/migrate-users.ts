import { withDatabase } from './utils/db';
export default async function migrateUsers() {
  await withDatabase(async (client) => {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        role_id UUID NOT NULL,
        department_id UUID NOT NULL,
        organization_id UUID NOT NULL,
        region CHAR(2) NOT NULL,
        salary NUMERIC(12,2) NOT NULL CHECK (salary >= 0),
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_department FOREIGN KEY(department_id) REFERENCES departments(department_id),
        CONSTRAINT fk_organization FOREIGN KEY(organization_id) REFERENCES organizations(organization_id),
        CONSTRAINT fk_role FOREIGN KEY(role_id) REFERENCES roles(role_id)
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_region ON users(region)');
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
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at'
        ) THEN
          CREATE TRIGGER update_users_updated_at
          BEFORE UPDATE ON users
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END;
      $$;
    `);
    console.log('Users table migrated successfully with auto-updating updated_at.');
  });
}