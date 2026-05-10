import * as crypto from 'node:crypto';

/**
 * Seeds realistic-looking workplace data for the organization identified by organizations.admin_email.
 *
 * Copy uses plausible Pakistani context (names, cities, Urdu–English notes). A hidden tag (__ORGSEED_V1__)
 * appears only in some description fields so the script can re-run safely.
 *
 * Usage (from backend/):
 *   npm run seed:tahajafri
 */

import bcrypt from 'bcryptjs';
import type { Client } from 'pg';
import { withDatabase } from './utils/db';

/** Organization admin sign-in (organizations.admin_email / admin_password_hash). */
const ORG_ADMIN_EMAIL = 'tahajafri12@gmail.com';
const ORG_ADMIN_PASSWORD = 'password123';
/** Used only when inserting a new organization row (if none exists for this admin_email). */
const ORG_NAME = 'Jafri Digital Solutions (Pvt) Ltd';
const ORG_ADDRESS = 'Office 408, Emerald City, Gulberg III, Lahore';
const PEER_EMAILS = ['hassan.raza.khi@gmail.com', 'ayesha.nadeem.lhr@gmail.com'] as const;
/** Portal user created only if the org has zero users (projects require manager_id). */
const SEED_MANAGER_EMAIL = 'usman.khan.ops@gmail.com';
const DEMO_USER_PASSWORD = 'password123';
/** Machine-only idempotency token (not meant for UI titles). */
const SEED_REF = '__ORGSEED_V1__';
const WELLNESS_SEED_TAG = '__WSEED__';
const ACTIVITY_SEED_ACTION = 'ORGSEED_V1';

const ROLES_SEED = [
	{ name: 'Admin', description: 'Full administrative access' },
	{ name: 'Manager', description: 'Manages teams and projects' },
	{ name: 'Engineer', description: 'Software engineer' },
];

const DEPT_NAMES = ['Software Engineering', 'Product & UX', 'Client Operations'];

const PROJECT_SPECS: ReadonlyArray<{ name: string; blurb: string }> = [
	{
		name: 'HBL Digital Channels — Release Train Q2',
		blurb:
			'Production hardening for internet banking and mobile app hotfixes; coordination with Karachi SOC and Lahore QA.',
	},
	{
		name: 'FBR PRAL Compliance Dashboard',
		blurb:
			'Monthly IRIS reconciliation views for finance; Urdu/English reporting pack for internal audit.',
	},
];

const TASK_COPY: ReadonlyArray<{ title: string; detail: string }> = [
	{
		title: 'UBL API sandbox — certificate rotation checklist',
		detail: 'Complete PFX renewal on staging; verify IP whitelisting for Gulberg office egress.',
	},
	{
		title: 'JazzCash webhook retries — dead-letter review',
		detail: 'Triage last 48h DLQ; document root causes for vendor call on Thursday.',
	},
	{
		title: 'Urdu onboarding microcopy — legal review',
		detail: 'Align disclaimers with compliance; export strings for Lokalise.',
	},
	{
		title: 'SBP reporting job — off-peak batch window',
		detail: 'Move cron to 02:00 PKT; add alerting on failure after two retries.',
	},
	{
		title: 'Lahore DC VPN split-tunnel test matrix',
		detail: 'Engineering sign-off for remote staff on PTCL and Nayatel home lines.',
	},
	{
		title: 'Customer L2 escalation playbook — v3',
		detail: 'Fold in Ramadan hours and escalation to on-call manager roster.',
	},
];

async function ensureRoles(client: Client): Promise<Map<string, string>> {
	const map = new Map<string, string>();
	for (const r of ROLES_SEED) {
		const ins = await client.query(
			`INSERT INTO roles (name, description) VALUES ($1, $2)
			 ON CONFLICT (name) DO NOTHING RETURNING role_id, name`,
			[r.name, r.description]
		);
		if (ins.rows.length > 0) {
			map.set(r.name, ins.rows[0].role_id);
		} else {
			const ex = await client.query(`SELECT role_id, name FROM roles WHERE name = $1`, [r.name]);
			map.set(r.name, ex.rows[0].role_id);
		}
	}
	return map;
}

async function ensureDepartments(client: Client, organizationId: string): Promise<string[]> {
	const ids: string[] = [];
	for (const name of DEPT_NAMES) {
		const ex = await client.query(
			`SELECT department_id FROM departments WHERE organization_id = $1 AND name = $2 LIMIT 1`,
			[organizationId, name]
		);
		if (ex.rows.length > 0) {
			ids.push(ex.rows[0].department_id);
			continue;
		}
		const ins = await client.query(
			`INSERT INTO departments (name, organization_id) VALUES ($1, $2) RETURNING department_id`,
			[name, organizationId]
		);
		ids.push(ins.rows[0].department_id);
	}
	return ids;
}

async function ensureOrganization(
	client: Client,
	adminEmail: string,
	passwordHash: string
): Promise<{ organizationId: string; orgName: string }> {
	const found = await client.query<{ organization_id: string; name: string }>(
		`SELECT organization_id, name FROM organizations WHERE admin_email = $1 LIMIT 1`,
		[adminEmail]
	);
	if (found.rows.length > 0) {
		const org = found.rows[0];
		await client.query(`UPDATE organizations SET admin_password_hash = $1 WHERE organization_id = $2`, [
			passwordHash,
			org.organization_id,
		]);
		return { organizationId: org.organization_id, orgName: org.name };
	}

	const ins = await client.query(
		`INSERT INTO organizations (name, organization_type, address, admin_email, admin_password_hash)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING organization_id, name`,
		[ORG_NAME, 'enterprise', ORG_ADDRESS, adminEmail, passwordHash]
	);
	return { organizationId: ins.rows[0].organization_id, orgName: ins.rows[0].name };
}

/**
 * Resolves a portal user_id for project manager / goals. Does not change passwords for existing members.
 */
async function ensureManagerUserForOrg(
	client: Client,
	organizationId: string,
	departmentId: string,
	demoUserPasswordHash: string,
	roles: Map<string, string>
): Promise<{ userId: string; email: string; createdSeedManager: boolean }> {
	const byRole = await client.query<{ user_id: string; email: string }>(
		`
		SELECT u.user_id, u.email
		FROM users u
		INNER JOIN roles r ON r.role_id = u.role_id
		WHERE u.organization_id = $1 AND r.name IN ('Admin', 'Manager')
		ORDER BY CASE r.name WHEN 'Admin' THEN 0 ELSE 1 END, u.created_at ASC
		LIMIT 1
		`,
		[organizationId]
	);
	if (byRole.rows.length > 0) {
		return {
			userId: byRole.rows[0].user_id,
			email: byRole.rows[0].email,
			createdSeedManager: false,
		};
	}

	const anyUser = await client.query<{ user_id: string; email: string }>(
		`SELECT user_id, email FROM users WHERE organization_id = $1 ORDER BY created_at ASC LIMIT 1`,
		[organizationId]
	);
	if (anyUser.rows.length > 0) {
		return {
			userId: anyUser.rows[0].user_id,
			email: anyUser.rows[0].email,
			createdSeedManager: false,
		};
	}

	const adminRoleId = roles.get('Admin')!;
	const ins = await client.query(
		`INSERT INTO users (name, email, role_id, department_id, organization_id, region, salary, password_hash)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING user_id, email`,
		[
			'Usman Khan',
			SEED_MANAGER_EMAIL,
			adminRoleId,
			departmentId,
			organizationId,
			'PK',
			2850000,
			demoUserPasswordHash,
		]
	);
	return {
		userId: ins.rows[0].user_id,
		email: ins.rows[0].email,
		createdSeedManager: true,
	};
}

async function ensurePeerUsers(
	client: Client,
	organizationId: string,
	departmentId: string,
	demoUserPasswordHash: string,
	roles: Map<string, string>
): Promise<string[]> {
	const engineerRoleId = roles.get('Engineer')!;
	const ids: string[] = [];
	const peers: ReadonlyArray<{ name: string }> = [{ name: 'Hassan Raza' }, { name: 'Ayesha Nadeem' }];
	for (let i = 0; i < PEER_EMAILS.length; i++) {
		const email = PEER_EMAILS[i];
		const ex = await client.query(`SELECT user_id, organization_id FROM users WHERE email = $1`, [email]);
		if (ex.rows.length > 0) {
			const row = ex.rows[0];
			if (row.organization_id !== organizationId) {
				console.warn(`  Skipping peer ${email}: already in another organization.`);
				continue;
			}
			await client.query(`UPDATE users SET password_hash = $1 WHERE user_id = $2`, [
				demoUserPasswordHash,
				row.user_id,
			]);
			ids.push(row.user_id);
			continue;
		}
		const ins = await client.query(
			`INSERT INTO users (name, email, role_id, department_id, organization_id, region, salary, password_hash)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			 RETURNING user_id`,
			[
				peers[i]!.name,
				email,
				engineerRoleId,
				departmentId,
				organizationId,
				'PK',
				1950000 + i * 120000,
				demoUserPasswordHash,
			]
		);
		ids.push(ins.rows[0].user_id);
	}
	return ids;
}

function isoDateOffset(daysFromToday: number): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() + daysFromToday);
	return d.toISOString().slice(0, 10);
}

async function seedProjectsTasksGoals(
	client: Client,
	organizationId: string,
	managerId: string,
	memberIds: string[]
): Promise<void> {
	const existingDemo = await client.query(
		`SELECT COUNT(*)::int AS c FROM projects WHERE organization_id = $1 AND description LIKE $2`,
		[organizationId, `%${SEED_REF}%`]
	);
	let projectIds: string[] = [];
	if (existingDemo.rows[0].c >= 2) {
		const r = await client.query(
			`SELECT project_id FROM projects WHERE organization_id = $1 AND description LIKE $2 ORDER BY created_at ASC`,
			[organizationId, `%${SEED_REF}%`]
		);
		projectIds = r.rows.map((x) => x.project_id);
	} else {
		for (let p = 0; p < PROJECT_SPECS.length; p++) {
			const spec = PROJECT_SPECS[p]!;
			const ins = await client.query(
				`INSERT INTO projects (name, description, manager_id, organization_id, start_date, end_date)
				 VALUES ($1, $2, $3, $4, $5, $6)
				 RETURNING project_id`,
				[
					spec.name,
					`${spec.blurb} ${SEED_REF}`,
					managerId,
					organizationId,
					isoDateOffset(-45),
					isoDateOffset(90),
				]
			);
			projectIds.push(ins.rows[0].project_id);
		}
	}

	for (const projectId of projectIds) {
		for (const uid of memberIds) {
			await client.query(
				`INSERT INTO project_members (project_id, user_id, role)
				 SELECT $1, $2, $3
				 WHERE NOT EXISTS (
				   SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2
				 )`,
				[projectId, uid, 'developer']
			);
		}
	}

	const taskCount = await client.query(
		`SELECT COUNT(*)::int AS c FROM tasks t
		 JOIN projects p ON p.project_id = t.project_id
		 WHERE p.organization_id = $1 AND t.description LIKE $2`,
		[organizationId, `%${SEED_REF}%`]
	);
	if (taskCount.rows[0].c < 1) {
		const statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'IN_PROGRESS', 'PENDING', 'COMPLETED'] as const;
		const priorities = ['HIGH', 'MEDIUM', 'LOW', 'MEDIUM', 'HIGH', 'MEDIUM'] as const;
		let i = 0;
		for (const projectId of projectIds) {
			for (let k = 0; k < 3; k++) {
				const assignee = memberIds[i % memberIds.length]!;
				const copy = TASK_COPY[i % TASK_COPY.length]!;
				await client.query(
					`INSERT INTO tasks (project_id, assigned_to, title, description, status, priority, deadline)
					 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
					[
						projectId,
						assignee,
						copy.title,
						`${copy.detail} ${SEED_REF}`,
						statuses[i % statuses.length],
						priorities[i % priorities.length],
						isoDateOffset(14 + (i % 20)),
					]
				);
				i++;
			}
		}
	}

	const g = await client.query(
		`SELECT COUNT(*)::int AS c FROM goals WHERE user_id = $1 AND description LIKE $2`,
		[managerId, `%${SEED_REF}%`]
	);
	if (g.rows[0].c < 1) {
		await client.query(
			`INSERT INTO goals (user_id, title, description, progress, deadline)
			 VALUES ($1, $2, $3, $4, $5), ($1, $6, $7, $8, $9)`,
			[
				managerId,
				'L1 support backlog — 30% reduction by June',
				`Track daily age of tickets in Freshdesk; weekly steering with Lahore shift lead. ${SEED_REF}`,
				72,
				isoDateOffset(40),
				'SOC 2 Type II — evidence locker for auditors',
				`Policies, access reviews, and vendor DPAs in shared drive; Urdu summary for management. ${SEED_REF}`,
				45,
				isoDateOffset(60),
			]
		);
	}
}

async function seedWellnessForUsers(client: Client, userIds: string[]): Promise<void> {
	const moods = ['Great', 'Good', 'Okay', 'Tired', 'Stressed'];
	const notesByDay = [
		`Aaj focus acha raha; team ne standup par blockers clear kar liye. ${WELLNESS_SEED_TAG}`,
		`Thora workload zyada tha lekin breaks le kar theek chal raha tha. ${WELLNESS_SEED_TAG}`,
		`Neend poori nahi thi; dopahar ke baad coffee se kaam ho gaya. ${WELLNESS_SEED_TAG}`,
		`Achha mahaul tha office mein — koi major stress nahi. ${WELLNESS_SEED_TAG}`,
		`Client call lambi thi; sham ko walk kar ke refresh ho gaya. ${WELLNESS_SEED_TAG}`,
	];
	for (const userId of userIds) {
		const c = await client.query(
			`SELECT COUNT(*)::int AS n FROM wellness_logs WHERE user_id = $1 AND notes LIKE $2`,
			[userId, `%${WELLNESS_SEED_TAG}%`]
		);
		if (c.rows[0].n >= 3) continue;
		for (let day = 0; day < 5; day++) {
			await client.query(
				`INSERT INTO wellness_logs (user_id, date, mood, energy_level, notes)
				 VALUES ($1, $2::date, $3, $4, $5)`,
				[
					userId,
					isoDateOffset(-day),
					moods[(day + userId.length) % moods.length],
					3 + (day % 5),
					notesByDay[day % notesByDay.length],
				]
			);
		}
	}
}

async function seedPayrollIfEmpty(client: Client, userId: string): Promise<void> {
	const c = await client.query(`SELECT COUNT(*)::int AS n FROM payroll WHERE user_id = $1`, [userId]);
	if (c.rows[0].n > 0) return;
	await client.query(
		`INSERT INTO payroll (user_id, period_start, period_end, amount)
		 VALUES ($1, $2, $3, $4)`,
		[userId, isoDateOffset(-30), isoDateOffset(-1), 285000]
	);
}

async function replaceDemoActivity(
	client: Client,
	organizationId: string,
	userIds: string[]
): Promise<void> {
	await client.query(
		`DELETE FROM activity_logs WHERE action = $1 AND user_id = ANY($2::uuid[])`,
		[ACTIVITY_SEED_ACTION, userIds]
	);

	for (const userId of userIds) {
		for (let day = 0; day < 21; day++) {
			for (let seg = 0; seg < 5; seg++) {
				const d = new Date();
				d.setUTCDate(d.getUTCDate() - day);
				d.setUTCHours(8 + seg * 2, (seg * 17 + userId.charCodeAt(0)) % 60, 0, 0);
				const duration = 900 + ((day + seg + userId.length) % 5) * 900;
				const deviceId = crypto.randomUUID();
				await client.query(
					`INSERT INTO activity_logs (user_id, device_id, action, description, created_at, updated_at)
					 VALUES ($1, $2, $3, $4, $5, $5)`,
					[userId, deviceId, ACTIVITY_SEED_ACTION, JSON.stringify({ duration }), d.toISOString()]
				);
			}
		}
	}
}

async function seedIdleDemo(client: Client, _organizationId: string, userIds: string[]): Promise<void> {
	for (const userId of userIds) {
		const c = await client.query(`SELECT COUNT(*)::int AS n FROM idle_logs WHERE user_id = $1`, [userId]);
		if (c.rows[0].n > 0) continue;
		for (let day = 0; day < 14; day++) {
			const d = new Date();
			d.setUTCDate(d.getUTCDate() - day);
			d.setUTCHours(14, 30, 0, 0);
			const deviceId = crypto.randomUUID();
			await client.query(
				`INSERT INTO idle_logs (device_id, user_id, idle_time, timestamp) VALUES ($1, $2, $3, $4)`,
				[deviceId, userId, 600 + (day % 4) * 120, d.toISOString()]
			);
		}
	}
}

async function main() {
	const orgPasswordHash = await bcrypt.hash(ORG_ADMIN_PASSWORD, 10);
	const demoUserPasswordHash = await bcrypt.hash(DEMO_USER_PASSWORD, 10);
	console.log('Org seed — starting…');
	console.log(`  Organization sign-in: ${ORG_ADMIN_EMAIL} / ${ORG_ADMIN_PASSWORD}`);
	console.log(`  Colleague accounts (password ${DEMO_USER_PASSWORD}): ${PEER_EMAILS.join(', ')}`);

	await withDatabase(async (client) => {
		await client.query('BEGIN');
		try {
			const roles = await ensureRoles(client);
			const org = await ensureOrganization(client, ORG_ADMIN_EMAIL, orgPasswordHash);
			console.log(`  Matched org: "${org.orgName}" (${org.organizationId})`);

			const deptIds = await ensureDepartments(client, org.organizationId);
			const manager = await ensureManagerUserForOrg(
				client,
				org.organizationId,
				deptIds[0]!,
				demoUserPasswordHash,
				roles
			);
			if (manager.createdSeedManager) {
				console.log(
					`  No users in org yet; created operations lead ${SEED_MANAGER_EMAIL} / ${DEMO_USER_PASSWORD} (portal).`
				);
			} else {
				console.log(`  Using existing member as project owner: ${manager.email}`);
			}

			const peerIds = await ensurePeerUsers(
				client,
				org.organizationId,
				deptIds[0]!,
				demoUserPasswordHash,
				roles
			);
			const allMemberIds = [manager.userId, ...peerIds];

			await seedProjectsTasksGoals(client, org.organizationId, manager.userId, allMemberIds);
			await seedWellnessForUsers(client, allMemberIds);
			await seedPayrollIfEmpty(client, manager.userId);
			await replaceDemoActivity(client, org.organizationId, allMemberIds);
			await seedIdleDemo(client, org.organizationId, allMemberIds);

			await client.query('COMMIT');
			console.log('Org seed — done.');
		} catch (e) {
			await client.query('ROLLBACK');
			throw e;
		}
	});
}

main().catch((err) => {
	console.error('Org seed failed:', err);
	process.exit(1);
});
