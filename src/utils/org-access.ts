import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import { error as errorResponse } from './response';
import { resolveCallerOrganizationId } from './resolve-org-from-auth';
import pool from '../config/db';

/** Resolve caller org or write 401 and return null. */
export async function requireCallerOrgId(
	req: AuthRequest,
	res: Response
): Promise<string | null> {
	const organizationId = await resolveCallerOrganizationId(req);
	if (!organizationId) {
		errorResponse(res, 'Unauthorized or missing organization', 401);
		return null;
	}
	return organizationId;
}

export async function projectBelongsToOrg(projectId: string, organizationId: string): Promise<boolean> {
	const result = await pool.query(
		`SELECT 1 FROM projects
		 WHERE project_id = $1 AND organization_id = $2 AND deleted_at IS NULL
		 LIMIT 1`,
		[projectId, organizationId]
	);
	return result.rows.length > 0;
}

export async function taskBelongsToOrg(taskId: string, organizationId: string): Promise<boolean> {
	const result = await pool.query(
		`SELECT 1
		 FROM tasks t
		 INNER JOIN projects p ON p.project_id = t.project_id
		 WHERE t.task_id = $1 AND p.organization_id = $2
		   AND t.deleted_at IS NULL AND p.deleted_at IS NULL
		 LIMIT 1`,
		[taskId, organizationId]
	);
	return result.rows.length > 0;
}

export async function goalBelongsToOrg(goalId: string, organizationId: string): Promise<boolean> {
	const result = await pool.query(
		`SELECT 1
		 FROM goals g
		 INNER JOIN users u ON u.user_id = g.user_id
		 WHERE g.goal_id = $1 AND u.organization_id = $2
		 LIMIT 1`,
		[goalId, organizationId]
	);
	return result.rows.length > 0;
}

export async function departmentBelongsToOrg(
	departmentId: string,
	organizationId: string
): Promise<boolean> {
	const result = await pool.query(
		`SELECT 1 FROM departments WHERE department_id = $1 AND organization_id = $2 LIMIT 1`,
		[departmentId, organizationId]
	);
	return result.rows.length > 0;
}

export async function payrollBelongsToOrg(payrollId: string, organizationId: string): Promise<boolean> {
	const result = await pool.query(
		`SELECT 1
		 FROM payroll pr
		 INNER JOIN users u ON u.user_id = pr.user_id
		 WHERE pr.payroll_id = $1 AND u.organization_id = $2
		 LIMIT 1`,
		[payrollId, organizationId]
	);
	return result.rows.length > 0;
}

export async function attendanceBelongsToOrg(
	attendanceId: string,
	organizationId: string
): Promise<boolean> {
	const result = await pool.query(
		`SELECT 1
		 FROM attendance a
		 INNER JOIN users u ON u.user_id = a.user_id
		 WHERE a.attendance_id = $1 AND u.organization_id = $2
		 LIMIT 1`,
		[attendanceId, organizationId]
	);
	return result.rows.length > 0;
}

export async function userBelongsToOrg(userId: string, organizationId: string): Promise<boolean> {
	const result = await pool.query(
		`SELECT 1 FROM users
		 WHERE user_id = $1 AND organization_id = $2 AND deleted_at IS NULL
		 LIMIT 1`,
		[userId, organizationId]
	);
	return result.rows.length > 0;
}

export async function courseInstructorInOrg(
	courseId: string,
	organizationId: string
): Promise<boolean> {
	const result = await pool.query(
		`SELECT 1
		 FROM courses c
		 INNER JOIN users u ON u.user_id = c.instructor_id
		 WHERE c.course_id = $1 AND u.organization_id = $2
		 LIMIT 1`,
		[courseId, organizationId]
	);
	return result.rows.length > 0;
}

type BelongFn = (id: string, organizationId: string) => Promise<boolean>;

/** Returns org id when resource is in caller tenant; otherwise writes 404 and returns null. */
export async function assertResourceInCallerOrg(
	req: AuthRequest,
	res: Response,
	resourceId: string,
	belongs: BelongFn,
	notFoundMessage = 'Not found'
): Promise<string | null> {
	const organizationId = await requireCallerOrgId(req, res);
	if (!organizationId) return null;
	if (!(await belongs(resourceId, organizationId))) {
		errorResponse(res, notFoundMessage, 404);
		return null;
	}
	return organizationId;
}
