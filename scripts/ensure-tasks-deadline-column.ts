/**
 * Adds tasks.deadline if missing (safe for DBs created before deadline support).
 * Run: npx ts-node scripts/ensure-tasks-deadline-column.ts
 * Or: npm run migrate:tasks-deadline
 */
import { withDatabase } from './utils/db';

async function main() {
  await withDatabase(async (client) => {
    await client.query(`
      DO $deadline$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'deadline'
        ) THEN
          ALTER TABLE tasks ADD COLUMN deadline DATE;
        END IF;
      END;
      $deadline$;
    `);
    console.log('Column tasks.deadline is present (added if it was missing).');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
