/**
 * Seed dummy data for the main application tables.
 *
 * Re-runnable: every insert is guarded by a uniqueness check or
 * `ON CONFLICT DO NOTHING`, so running this multiple times is safe and
 * will not duplicate rows.
 *
 * Tables covered (in dependency order):
 *   organizations -> roles -> departments -> users
 *   -> projects -> project_members -> tasks
 *   -> attendance -> goals
 *   -> courses -> course_enrollments
 *   -> wellness_logs -> notifications -> payroll
 *
 * All seeded users share the password: Password1!
 *
 * Usage:
 *   npm run seed
 */

import bcrypt from 'bcryptjs';
import type { Client } from 'pg';
import { withDatabase } from './utils/db';

const SEED_PASSWORD = 'Password1!';

type Org = { organization_id: string; name: string };
type Role = { role_id: string; name: string };
type Dept = { department_id: string; name: string; organization_id: string };
type User = {
	user_id: string;
	email: string;
	name: string;
	role_name: string;
	organization_id: string;
	department_id: string;
};
type Project = { project_id: string; name: string; organization_id: string; manager_id: string };
type Course = { course_id: string; title: string; instructor_id: string };

const ORGANIZATIONS = [
	{
		name: 'Acme Corporation',
		organization_type: 'enterprise',
		address: '123 Industrial Way, Springfield',
		admin_email: 'admin@acme.test',
	},
	{
		name: 'Globex Inc',
		organization_type: 'startup',
		address: '500 Innovation Blvd, Metropolis',
		admin_email: 'admin@globex.test',
	},
];

const ROLES = [
	{ name: 'Admin', description: 'Full administrative access' },
	{ name: 'Manager', description: 'Manages teams and projects' },
	{ name: 'Engineer', description: 'Software/hardware engineer' },
	{ name: 'Designer', description: 'Product / UI designer' },
	{ name: 'HR', description: 'Human resources' },
];

const DEPARTMENTS_PER_ORG = ['Engineering', 'Design', 'Operations'];

const FIRST_NAMES = [
	'Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie',
	'Avery', 'Quinn', 'Reese', 'Sage', 'Emerson', 'Drew', 'Hayden',
];
const LAST_NAMES = [
	'Smith', 'Johnson', 'Lee', 'Brown', 'Garcia', 'Davis', 'Miller', 'Wilson',
	'Anderson', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Clark', 'Lewis',
];

const MOODS = ['Great', 'Good', 'Okay', 'Tired', 'Stressed'];
const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done'];
const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'];
const NOTIFICATION_TYPES = ['task', 'project', 'announcement', 'wellness'];
const PROJECT_MEMBER_ROLES = ['developer', 'tester', 'designer', 'analyst'];

const COURSES = [
	{ title: 'TypeScript Fundamentals', description: 'Strongly-typed JavaScript from the ground up.' },
	{ title: 'PostgreSQL for Backend Engineers', description: 'Indexes, joins, transactions, and beyond.' },
	{ title: 'Express + Zod Best Practices', description: 'Reliable validation and error handling.' },
	{ title: 'Workplace Wellness 101', description: 'Habits and tools for a healthier remote-work life.' },
	{ title: 'Effective 1:1s for Managers', description: 'Templates, agendas, and follow-ups that work.' },
];

function pick<T>(arr: readonly T[], i: number): T {
	return arr[i % arr.length];
}

function pad(n: number, width = 3): string {
	return n.toString().padStart(width, '0');
}

function isoDateOffset(daysFromToday: number): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() + daysFromToday);
	return d.toISOString().slice(0, 10);
}

function isoTimestampOffset(hoursFromNow: number): string {
	const d = new Date();
	d.setUTCHours(d.getUTCHours() + hoursFromNow);
	return d.toISOString();
}

async function seedOrganizations(client: Client, passwordHash: string): Promise<Org[]> {
	const orgs: Org[] = [];
	for (const o of ORGANIZATIONS) {
		const insert = await client.query(
			`INSERT INTO organizations (name, organization_type, address, admin_email, admin_password_hash)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (name) DO NOTHING
			 RETURNING organization_id, name`,
			[o.name, o.organization_type, o.address, o.admin_email, passwordHash]
		);
		if (insert.rows.length > 0) {
			orgs.push(insert.rows[0]);
		} else {
			const existing = await client.query(
				`SELECT organization_id, name FROM organizations WHERE name = $1`,
				[o.name]
			);
			orgs.push(existing.rows[0]);
		}
	}
	console.log(`  organizations: ${orgs.length}`);
	return orgs;
}

async function seedRoles(client: Client): Promise<Role[]> {
	const roles: Role[] = [];
	for (const r of ROLES) {
		const insert = await client.query(
			`INSERT INTO roles (name, description)
			 VALUES ($1, $2)
			 ON CONFLICT (name) DO NOTHING
			 RETURNING role_id, name`,
			[r.name, r.description]
		);
		if (insert.rows.length > 0) {
			roles.push(insert.rows[0]);
		} else {
			const existing = await client.query(
				`SELECT role_id, name FROM roles WHERE name = $1`,
				[r.name]
			);
			roles.push(existing.rows[0]);
		}
	}
	console.log(`  roles: ${roles.length}`);
	return roles;
}

async function seedDepartments(client: Client, orgs: Org[]): Promise<Dept[]> {
	const depts: Dept[] = [];
	for (const org of orgs) {
		for (const name of DEPARTMENTS_PER_ORG) {
			const existing = await client.query(
				`SELECT department_id, name, organization_id FROM departments
				 WHERE organization_id = $1 AND name = $2 LIMIT 1`,
				[org.organization_id, name]
			);
			if (existing.rows.length > 0) {
				depts.push(existing.rows[0]);
				continue;
			}
			const insert = await client.query(
				`INSERT INTO departments (name, organization_id)
				 VALUES ($1, $2)
				 RETURNING department_id, name, organization_id`,
				[name, org.organization_id]
			);
			depts.push(insert.rows[0]);
		}
	}
	console.log(`  departments: ${depts.length}`);
	return depts;
}

async function seedUsers(
	client: Client,
	orgs: Org[],
	roles: Role[],
	depts: Dept[],
	passwordHash: string
): Promise<User[]> {
	const users: User[] = [];
	const usersPerOrg = 15;
	let counter = 0;
	for (const org of orgs) {
		const orgDepts = depts.filter((d) => d.organization_id === org.organization_id);
		const orgSlug = org.name.toLowerCase().replace(/[^a-z0-9]+/g, '');

		// Always seed an admin per org so login flows have a known account.
		const adminEmail = `admin.${orgSlug}@example.com`;
		const adminRole = roles.find((r) => r.name === 'Admin') || roles[0];
		await upsertUser(client, users, {
			email: adminEmail,
			name: `Admin ${org.name}`,
			roleName: adminRole.name,
			roleId: adminRole.role_id,
			departmentId: orgDepts[0].department_id,
			organizationId: org.organization_id,
			region: orgSlug.startsWith('acme') ? 'US' : 'GB',
			salary: 120000,
			passwordHash,
		});

		for (let i = 0; i < usersPerOrg; i++) {
			const fn = pick(FIRST_NAMES, counter);
			const ln = pick(LAST_NAMES, counter * 7 + i);
			const role = pick(roles.filter((r) => r.name !== 'Admin'), counter + i);
			const dept = pick(orgDepts, counter + i);
			const email = `${fn.toLowerCase()}.${ln.toLowerCase()}.${orgSlug}.${pad(counter)}@example.com`;
			await upsertUser(client, users, {
				email,
				name: `${fn} ${ln}`,
				roleName: role.name,
				roleId: role.role_id,
				departmentId: dept.department_id,
				organizationId: org.organization_id,
				region: orgSlug.startsWith('acme') ? 'US' : 'GB',
				salary: 60000 + (counter % 6) * 5000,
				passwordHash,
			});
			counter++;
		}
	}
	console.log(`  users: ${users.length}`);
	return users;
}

async function upsertUser(
	client: Client,
	collected: User[],
	u: {
		email: string;
		name: string;
		roleName: string;
		roleId: string;
		departmentId: string;
		organizationId: string;
		region: string;
		salary: number;
		passwordHash: string;
	}
): Promise<void> {
	const insert = await client.query(
		`INSERT INTO users (
			name, email, role_id, department_id, organization_id, region, salary, password_hash
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (email) DO NOTHING
		RETURNING user_id, email, name`,
		[
			u.name,
			u.email,
			u.roleId,
			u.departmentId,
			u.organizationId,
			u.region,
			u.salary,
			u.passwordHash,
		]
	);
	let row: { user_id: string; email: string; name: string };
	if (insert.rows.length > 0) {
		row = insert.rows[0];
	} else {
		const existing = await client.query(
			`SELECT user_id, email, name FROM users WHERE email = $1`,
			[u.email]
		);
		row = existing.rows[0];
	}
	collected.push({
		user_id: row.user_id,
		email: row.email,
		name: row.name,
		role_name: u.roleName,
		organization_id: u.organizationId,
		department_id: u.departmentId,
	});
}

async function seedProjects(client: Client, orgs: Org[], users: User[]): Promise<Project[]> {
	const existingCount = await client.query(`SELECT COUNT(*)::int AS count FROM projects`);
	if (existingCount.rows[0].count > 0) {
		const all = await client.query(
			`SELECT project_id, name, organization_id, manager_id FROM projects`
		);
		console.log(`  projects: ${all.rows.length} (already existed, skipped)`);
		return all.rows;
	}

	const projects: Project[] = [];
	const projectsPerOrg = 4;
	let i = 0;
	for (const org of orgs) {
		const orgManagers = users.filter(
			(u) => u.organization_id === org.organization_id && u.role_name === 'Manager'
		);
		const fallbackManagers = users.filter((u) => u.organization_id === org.organization_id);
		for (let p = 0; p < projectsPerOrg; p++, i++) {
			const manager = pick(orgManagers.length ? orgManagers : fallbackManagers, p);
			const start = isoDateOffset(-30 - p * 14);
			const end = isoDateOffset(60 + p * 14);
			const insert = await client.query(
				`INSERT INTO projects (name, description, manager_id, organization_id, start_date, end_date)
				 VALUES ($1, $2, $3, $4, $5, $6)
				 RETURNING project_id, name, organization_id, manager_id`,
				[
					`Project ${pad(i + 1)} - ${org.name}`,
					`Auto-seeded project #${i + 1} for ${org.name}.`,
					manager.user_id,
					org.organization_id,
					start,
					end,
				]
			);
			projects.push(insert.rows[0]);
		}
	}
	console.log(`  projects: ${projects.length}`);
	return projects;
}

async function seedProjectMembers(client: Client, projects: Project[], users: User[]) {
	const existing = await client.query(`SELECT COUNT(*)::int AS count FROM project_members`);
	if (existing.rows[0].count > 0) {
		console.log(`  project_members: ${existing.rows[0].count} (already existed, skipped)`);
		return;
	}
	let inserted = 0;
	for (const project of projects) {
		const orgUsers = users.filter((u) => u.organization_id === project.organization_id);
		const memberCount = Math.min(4, orgUsers.length);
		const used = new Set<string>();
		for (let i = 0; i < memberCount; i++) {
			const user = orgUsers[(i * 3) % orgUsers.length];
			if (used.has(user.user_id)) continue;
			used.add(user.user_id);
			await client.query(
				`INSERT INTO project_members (project_id, user_id, role)
				 VALUES ($1, $2, $3)`,
				[project.project_id, user.user_id, pick(PROJECT_MEMBER_ROLES, i)]
			);
			inserted++;
		}
	}
	console.log(`  project_members: ${inserted}`);
}

async function seedTasks(client: Client, projects: Project[], users: User[]) {
	const existing = await client.query(`SELECT COUNT(*)::int AS count FROM tasks`);
	if (existing.rows[0].count > 0) {
		console.log(`  tasks: ${existing.rows[0].count} (already existed, skipped)`);
		return;
	}
	let inserted = 0;
	for (const project of projects) {
		const orgUsers = users.filter((u) => u.organization_id === project.organization_id);
		for (let i = 0; i < 8; i++) {
			const assignee = orgUsers[(i * 5 + 1) % orgUsers.length];
			await client.query(
				`INSERT INTO tasks (project_id, assigned_to, title, description, status, priority)
				 VALUES ($1, $2, $3, $4, $5, $6)`,
				[
					project.project_id,
					assignee.user_id,
					`Task ${pad(i + 1)} for ${project.name}`,
					`Auto-seeded task #${i + 1}.`,
					pick(TASK_STATUSES, i),
					pick(TASK_PRIORITIES, i),
				]
			);
			inserted++;
		}
	}
	console.log(`  tasks: ${inserted}`);
}

async function seedAttendance(client: Client, users: User[]) {
	const existing = await client.query(`SELECT COUNT(*)::int AS count FROM attendance`);
	if (existing.rows[0].count > 0) {
		console.log(`  attendance: ${existing.rows[0].count} (already existed, skipped)`);
		return;
	}
	let inserted = 0;
	for (const user of users) {
		for (let day = 1; day <= 3; day++) {
			const checkIn = isoTimestampOffset(-day * 24);
			const checkOut = isoTimestampOffset(-day * 24 + 8);
			await client.query(
				`INSERT INTO attendance (user_id, device_id, check_in, check_out, location)
				 VALUES ($1, NULL, $2, $3, $4)`,
				[user.user_id, checkIn, checkOut, day % 2 === 0 ? 'Office' : 'Remote']
			);
			inserted++;
		}
	}
	console.log(`  attendance: ${inserted}`);
}

async function seedGoals(client: Client, users: User[]) {
	const existing = await client.query(`SELECT COUNT(*)::int AS count FROM goals`);
	if (existing.rows[0].count > 0) {
		console.log(`  goals: ${existing.rows[0].count} (already existed, skipped)`);
		return;
	}
	let inserted = 0;
	for (const [i, user] of users.entries()) {
		await client.query(
			`INSERT INTO goals (user_id, title, description, progress, deadline)
			 VALUES ($1, $2, $3, $4, $5)`,
			[
				user.user_id,
				`Quarterly objective for ${user.name}`,
				'Improve team velocity and code quality.',
				(i * 17) % 101,
				isoDateOffset(45 + (i % 30)),
			]
		);
		inserted++;
	}
	console.log(`  goals: ${inserted}`);
}

async function seedCourses(client: Client, users: User[]): Promise<Course[]> {
	const existing = await client.query(`SELECT course_id, title, instructor_id FROM courses`);
	if (existing.rows.length > 0) {
		console.log(`  courses: ${existing.rows.length} (already existed, skipped)`);
		return existing.rows;
	}
	const instructors = users.filter((u) => u.role_name === 'Manager' || u.role_name === 'Admin');
	const pool = instructors.length ? instructors : users;
	const created: Course[] = [];
	for (const [i, c] of COURSES.entries()) {
		const instructor = pick(pool, i);
		const insert = await client.query(
			`INSERT INTO courses (title, description, instructor_id)
			 VALUES ($1, $2, $3)
			 RETURNING course_id, title, instructor_id`,
			[c.title, c.description, instructor.user_id]
		);
		created.push(insert.rows[0]);
	}
	console.log(`  courses: ${created.length}`);
	return created;
}

async function seedCourseEnrollments(client: Client, courses: Course[], users: User[]) {
	const existing = await client.query(`SELECT COUNT(*)::int AS count FROM course_enrollments`);
	if (existing.rows[0].count > 0) {
		console.log(`  course_enrollments: ${existing.rows[0].count} (already existed, skipped)`);
		return;
	}
	const statuses = ['enrolled', 'in_progress', 'completed'];
	let inserted = 0;
	for (const [i, course] of courses.entries()) {
		// Enroll 5 users per course.
		for (let j = 0; j < 5 && j < users.length; j++) {
			const user = users[(i * 7 + j * 3) % users.length];
			const status = pick(statuses, j);
			const completedAt = status === 'completed' ? isoTimestampOffset(-24 * (j + 1)) : null;
			await client.query(
				`INSERT INTO course_enrollments (course_id, user_id, status, progress, completed_at)
				 VALUES ($1, $2, $3, $4, $5)`,
				[
					course.course_id,
					user.user_id,
					status,
					status === 'completed' ? 100 : (j * 20) % 100,
					completedAt,
				]
			);
			inserted++;
		}
	}
	console.log(`  course_enrollments: ${inserted}`);
}

async function seedWellnessLogs(client: Client, users: User[]) {
	const existing = await client.query(`SELECT COUNT(*)::int AS count FROM wellness_logs`);
	if (existing.rows[0].count > 0) {
		console.log(`  wellness_logs: ${existing.rows[0].count} (already existed, skipped)`);
		return;
	}
	let inserted = 0;
	for (const [i, user] of users.entries()) {
		for (let day = 0; day < 2; day++) {
			await client.query(
				`INSERT INTO wellness_logs (user_id, date, mood, energy_level, notes)
				 VALUES ($1, $2, $3, $4, $5)`,
				[
					user.user_id,
					isoDateOffset(-day),
					pick(MOODS, i + day),
					3 + ((i + day) % 6),
					day === 0 ? 'Feeling productive today.' : 'Low-key day.',
				]
			);
			inserted++;
		}
	}
	console.log(`  wellness_logs: ${inserted}`);
}

async function seedNotifications(client: Client, users: User[]) {
	const existing = await client.query(`SELECT COUNT(*)::int AS count FROM notifications`);
	if (existing.rows[0].count > 0) {
		console.log(`  notifications: ${existing.rows[0].count} (already existed, skipped)`);
		return;
	}
	let inserted = 0;
	for (const [i, user] of users.entries()) {
		for (let n = 0; n < 2; n++) {
			await client.query(
				`INSERT INTO notifications (user_id, type, message, read)
				 VALUES ($1, $2, $3, $4)`,
				[
					user.user_id,
					pick(NOTIFICATION_TYPES, i + n),
					`Hello ${user.name}, you have a new ${pick(NOTIFICATION_TYPES, i + n)} update.`,
					n % 2 === 0,
				]
			);
			inserted++;
		}
	}
	console.log(`  notifications: ${inserted}`);
}

async function seedPayroll(client: Client, users: User[]) {
	const existing = await client.query(`SELECT COUNT(*)::int AS count FROM payroll`);
	if (existing.rows[0].count > 0) {
		console.log(`  payroll: ${existing.rows[0].count} (already existed, skipped)`);
		return;
	}
	const periodStart = isoDateOffset(-30);
	const periodEnd = isoDateOffset(-1);
	let inserted = 0;
	for (const [i, user] of users.entries()) {
		await client.query(
			`INSERT INTO payroll (user_id, period_start, period_end, amount)
			 VALUES ($1, $2, $3, $4)`,
			[user.user_id, periodStart, periodEnd, 4000 + (i % 6) * 250]
		);
		inserted++;
	}
	console.log(`  payroll: ${inserted}`);
}

async function main() {
	console.log('Seeding dummy data...');
	console.log(`Default password for every seeded user: ${SEED_PASSWORD}`);

	const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

	await withDatabase(async (client) => {
		await client.query('BEGIN');
		try {
			const orgs = await seedOrganizations(client, passwordHash);
			const roles = await seedRoles(client);
			const depts = await seedDepartments(client, orgs);
			const users = await seedUsers(client, orgs, roles, depts, passwordHash);
			const projects = await seedProjects(client, orgs, users);
			await seedProjectMembers(client, projects, users);
			await seedTasks(client, projects, users);
			await seedAttendance(client, users);
			await seedGoals(client, users);
			const courses = await seedCourses(client, users);
			await seedCourseEnrollments(client, courses, users);
			await seedWellnessLogs(client, users);
			await seedNotifications(client, users);
			await seedPayroll(client, users);
			await client.query('COMMIT');
			console.log('Seed complete.');
		} catch (err) {
			await client.query('ROLLBACK');
			throw err;
		}
	});
}

main().catch((err) => {
	console.error('Seed failed:', err);
	process.exit(1);
});
