/**
 * Removes rows created by scripts/seed.ts for projects, tasks, and goals.
 * Matches the literal description/title patterns used in the seed (not whole-table TRUNCATE).
 *
 * Usage: npm run clear:seeded-ptg
 */
import { withDatabase } from './utils/db';

async function tableExists(client: import('pg').Client, name: string): Promise<boolean> {
	const r = await client.query(
		`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
		[name]
	);
	return r.rows.length > 0;
}

async function main() {
	console.log('Clearing seeded projects, tasks, and goals...');

	await withDatabase(async (client) => {
		await client.query('BEGIN');
		try {
			const hasTaskComments = await tableExists(client, 'task_comments');
			const hasTaskAttachments = await tableExists(client, 'task_attachments');
			const hasWorkSessions = await tableExists(client, 'work_sessions');
			const hasKpis = await tableExists(client, 'kpis');

			const seededProjectIds = await client.query<{ project_id: string }>(
				`SELECT project_id FROM projects WHERE description LIKE 'Auto-seeded project #%'`
			);
			const ids = seededProjectIds.rows.map((r) => r.project_id);

			if (ids.length > 0) {
				const idList = ids.map((_, i) => `$${i + 1}`).join(', ');

				const taskIdsRes = await client.query<{ task_id: string }>(
					`SELECT task_id FROM tasks WHERE project_id IN (${idList})`,
					ids
				);
				const taskIds = taskIdsRes.rows.map((r) => r.task_id);

				if (taskIds.length > 0) {
					const tPlaceholders = taskIds.map((_, i) => `$${i + 1}`).join(', ');
					if (hasTaskComments) {
						await client.query(`DELETE FROM task_comments WHERE task_id IN (${tPlaceholders})`, taskIds);
					}
					if (hasTaskAttachments) {
						await client.query(`DELETE FROM task_attachments WHERE task_id IN (${tPlaceholders})`, taskIds);
					}
				}

				await client.query(`DELETE FROM tasks WHERE project_id IN (${idList})`, ids);

				if (hasWorkSessions) {
					await client.query(`DELETE FROM work_sessions WHERE project_id IN (${idList})`, ids);
				}

				await client.query(`DELETE FROM project_members WHERE project_id IN (${idList})`, ids);
				await client.query(`DELETE FROM projects WHERE project_id IN (${idList})`, ids);
			}

			/** Same title+description as seedGoals() in seed.ts */
			const seededGoals = await client.query<{ goal_id: string }>(
				`SELECT goal_id FROM goals
         WHERE description = 'Improve team velocity and code quality.'
           AND title LIKE 'Quarterly objective for %'`
			);
			const goalIds = seededGoals.rows.map((r) => r.goal_id);
			if (goalIds.length > 0) {
				const gPlaceholders = goalIds.map((_, i) => `$${i + 1}`).join(', ');
				if (hasKpis) {
					await client.query(`DELETE FROM kpis WHERE goal_id IN (${gPlaceholders})`, goalIds);
				}
				await client.query(`DELETE FROM goals WHERE goal_id IN (${gPlaceholders})`, goalIds);
			}

			await client.query('COMMIT');
			console.log(`  projects removed: ${ids.length}`);
			console.log(`  goals removed: ${goalIds.length}`);
			console.log('Done.');
		} catch (err) {
			await client.query('ROLLBACK');
			throw err;
		}
	});
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
