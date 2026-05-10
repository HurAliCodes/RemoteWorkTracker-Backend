/**
 * Deletes course_enrollments rows for courses created by scripts/seed.ts (COURSES titles).
 * Does not delete courses or users.
 *
 * Usage: npm run clear:seeded-enrollments
 */
import { withDatabase } from './utils/db';

/** Must match `COURSES` titles in scripts/seed.ts */
const SEEDED_COURSE_TITLES = [
	'TypeScript Fundamentals',
	'PostgreSQL for Backend Engineers',
	'Express + Zod Best Practices',
	'Workplace Wellness 101',
	'Effective 1:1s for Managers',
] as const;

async function main() {
	console.log('Deleting seeded course enrollments...');

	await withDatabase(async (client) => {
		const result = await client.query(
			`DELETE FROM course_enrollments
       WHERE course_id IN (
         SELECT course_id FROM courses WHERE title = ANY($1::text[])
       )`,
			[SEEDED_COURSE_TITLES]
		);
		console.log(`  rows deleted: ${result.rowCount ?? 0}`);
		console.log('Done.');
	});
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
