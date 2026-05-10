import { getDb } from '../../config/db';
import pool from '../../config/db';
import logger from '../../config/logger';
import crypto from 'crypto';
import { publishProjectEvent } from '../../utils/rabbitmq';

const db = getDb();

export interface CreateProjectInput {
  name: string;
  description?: string;
  manager_id: string;
  organization_id: string;
  start_date: string;
  end_date: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  manager_id?: string;
  start_date?: string;
  end_date?: string;
}

export async function createProjectService(data: CreateProjectInput) {
  if (!data.name || data.name.length < 1 || data.name.length > 100) {
    throw new Error('Project name must be between 1 and 100 characters.');
  }
  const org = await db.findOne('organizations', { organization_id: data.organization_id });
  if (!org) throw new Error('Organization not found.');
  const manager = await db.findOne('users', { user_id: data.manager_id });
  if (!manager) throw new Error('Manager (user) not found.');
  const start = new Date(data.start_date);
  const end = new Date(data.end_date);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error('Invalid start_date or end_date.');
  if (end < start) throw new Error('end_date must be on or after start_date.');

  const project_id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert('projects', {
    project_id,
    name: data.name,
    description: data.description ?? null,
    manager_id: data.manager_id,
    organization_id: data.organization_id,
    start_date: data.start_date,
    end_date: data.end_date,
    created_at: now,
    updated_at: now,
  });
  logger.info('Project created', { project_id, name: data.name });
  const createdProject = {
    project_id,
    name: data.name,
    description: data.description ?? null,
    manager_id: data.manager_id,
    organization_id: data.organization_id,
    start_date: data.start_date,
    end_date: data.end_date,
    created_at: now
  };
  // Emit project created event
  try {
    await publishProjectEvent({
      type: 'project:created',
      projectId: project_id,
      data: createdProject,
    });
  } catch (err) {
    logger.error('Failed to publish project:created event', { error: err });
  }
  return createdProject;
}

export async function getAllProjectsService(opts: { page?: number; limit?: number; organization_id?: string }) {
  const page = opts.page ?? 1;
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const offset = (page - 1) * limit;
  const hasOrg = opts.organization_id && opts.organization_id.length > 0;

  const whereClause = hasOrg ? 'WHERE p.organization_id = $1' : '';
  const countParams = hasOrg ? [opts.organization_id] : [];
  const listParams = hasOrg ? [opts.organization_id, limit, offset] : [limit, offset];
  const listPlaceholders = hasOrg ? 'LIMIT $2 OFFSET $3' : 'LIMIT $1 OFFSET $2';

  const countQuery = `SELECT COUNT(*) FROM projects p ${whereClause}`;
  const countResult = await pool.query(countQuery, countParams);
  const totalRecords = parseInt(countResult.rows[0].count, 10);
  const totalPages = Math.ceil(totalRecords / limit) || 1;

  const listQuery = `
    SELECT p.project_id, p.name, p.description, p.manager_id, p.organization_id, p.start_date, p.end_date, p.created_at, p.updated_at
    FROM projects p
    ${whereClause}
    ORDER BY p.created_at DESC
    ${listPlaceholders}
  `;
  const listResult = await pool.query(listQuery, listParams);
  const data = listResult.rows.map((row: any) => ({
    project_id: row.project_id,
    name: row.name,
    description: row.description,
    manager_id: row.manager_id,
    organization_id: row.organization_id,
    start_date: row.start_date,
    end_date: row.end_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return { meta: { page, limit, totalRecords, totalPages }, data };
}

export async function getProjectByIdService(id: string) {
  const project = await db.findOne('projects', { project_id: id });
  return project;
}

export async function updateProjectService(id: string, data: UpdateProjectInput) {
  const existing = await db.findOne('projects', { project_id: id });
  if (!existing) throw new Error('Project not found.');

  if (data.name !== undefined) {
    if (data.name.length < 1 || data.name.length > 100) throw new Error('Project name must be between 1 and 100 characters.');
  }
  if (data.manager_id !== undefined) {
    const manager = await db.findOne('users', { user_id: data.manager_id });
    if (!manager) throw new Error('Manager (user) not found.');
  }
  if (data.start_date !== undefined) {
    const d = new Date(data.start_date);
    if (isNaN(d.getTime())) throw new Error('Invalid start_date.');
  }
  if (data.end_date !== undefined) {
    const d = new Date(data.end_date);
    if (isNaN(d.getTime())) throw new Error('Invalid end_date.');
  }
  const start = data.start_date ? new Date(data.start_date) : new Date(existing.start_date);
  const end = data.end_date ? new Date(data.end_date) : new Date(existing.end_date);
  if (end < start) throw new Error('end_date must be on or after start_date.');

  const allowed = ['name', 'description', 'manager_id', 'start_date', 'end_date'];
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if ((data as any)[key] !== undefined) updates[key] = (data as any)[key];
  }
  const setClause = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = Object.values(updates);
  await pool.query(`UPDATE projects SET ${setClause} WHERE project_id = $${values.length + 1}`, [...values, id]);
  const updated = await db.findOne('projects', { project_id: id });
  // Emit project updated event
  try {
    await publishProjectEvent({
      type: 'project:updated',
      projectId: id,
      data: updated,
    });
  } catch (err) {
    logger.error('Failed to publish project:updated event', { error: err });
  }
  return updated;
}

export async function deleteProjectService(id: string) {
  const existing = await db.findOne('projects', { project_id: id });
  if (!existing) throw new Error('Project not found.');
  await pool.query('DELETE FROM project_members WHERE project_id = $1', [id]);
  await pool.query('DELETE FROM projects WHERE project_id = $1', [id]);
  logger.info('Project deleted', { project_id: id });
  return { message: 'Project deleted successfully.' };
}



export async function addProjectMemberService(projectId: string, userId: string, role?: string) {
  const project = await db.findOne('projects', { project_id: projectId });
  if (!project) throw new Error('Project not found.');
  const user = await db.findOne('users', { user_id: userId });
  if (!user) throw new Error('User not found.');
  const existing = await pool.query(
    'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, userId]
  );
  if (existing.rowCount && existing.rowCount > 0) throw new Error('User is already a member of this project.');

  const member_id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert('project_members', {
    member_id,
    project_id: projectId,
    user_id: userId,
    role: role ?? null,
    joined_at: now,
    created_at: now,
    updated_at: now,
  });
  const row = await db.findOne('project_members', { member_id });
  // Emit project member added event
  try {
    await publishProjectEvent({
      type: 'project:member:added',
      userId,
      projectId,
      data: row,
    });
  } catch (err) {
    logger.error('Failed to publish project:member:added event', { error: err });
  }
  return row;
}

export async function removeProjectMemberService(projectId: string, userId: string) {
  const project = await db.findOne('projects', { project_id: projectId });
  if (!project) throw new Error('Project not found.');
  const result = await pool.query(
    'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 RETURNING member_id',
    [projectId, userId]
  );
  if (!result.rowCount || result.rowCount === 0) throw new Error('Project member not found.');
  // Emit project member removed event
  try {
    await publishProjectEvent({
      type: 'project:member:removed',
      userId,
      projectId,
      data: { userId, projectId },
    });
  } catch (err) {
    logger.error('Failed to publish project:member:removed event', { error: err });
  }
  return { message: 'Member removed from project successfully.' };
}

export async function listProjectMembersService(projectId: string) {
  const project = await db.findOne('projects', { project_id: projectId });
  if (!project) throw new Error('Project not found.');
  const result = await pool.query(
    `SELECT pm.user_id, u.name, pm.role
     FROM project_members pm
     INNER JOIN users u ON u.user_id = pm.user_id
     WHERE pm.project_id = $1
     ORDER BY u.name ASC NULLS LAST`,
    [projectId]
  );
  return result.rows.map((row: { user_id: string; name: string | null; role: string | null }) => ({
    userId: row.user_id,
    name: row.name,
    role: row.role,
  }));
}
