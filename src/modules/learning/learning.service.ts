import crypto from 'crypto';
import { getDb } from '../../config/db';
import pool from '../../config/db';
import logger from '../../config/logger';

const db = getDb();

export interface CreateCourseInput {
  title: string;
  description?: string;
  instructorId: string;
}

export interface UpdateCourseInput {
  title?: string;
  description?: string;
  instructorId?: string;
}

export interface EnrollCourseInput {
  userId: string;
}

const mapCourseRow = (row: any) => ({
  courseId: row.course_id,
  title: row.title,
  description: row.description,
  instructorId: row.instructor_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapEnrollmentRow = (row: any) => ({
  enrollmentId: row.enrollment_id,
  courseId: row.course_id,
  userId: row.user_id,
  status: row.status,
  progress: Number(row.progress ?? 0),
  completedAt: row.completed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  course: row.course_id
    ? {
        courseId: row.course_id,
        title: row.course_title,
      }
    : undefined,
});

export async function createCourseService(input: CreateCourseInput) {
  const instructor = await db.findOne('users', { user_id: input.instructorId });
  if (!instructor) throw new Error('Instructor not found.');

  const courseId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert('courses', {
    course_id: courseId,
    title: input.title,
    description: input.description ?? null,
    instructor_id: input.instructorId,
    created_at: now,
    updated_at: now,
  });

  const created = await db.findOne('courses', { course_id: courseId });
  logger.info('Course created', { course_id: courseId, instructor_id: input.instructorId });
  return mapCourseRow(created);
}

export async function listCoursesService(opts: { page?: number; limit?: number }) {
  const page = opts.page ?? 1;
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const offset = (page - 1) * limit;

  const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM courses');
  const totalRecords = Number(countResult.rows[0]?.count ?? 0);
  const totalPages = Math.ceil(totalRecords / limit) || 1;

  const listResult = await pool.query(
    `
      SELECT course_id, title, description, instructor_id, created_at, updated_at
      FROM courses
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );

  return {
    meta: {
      page,
      limit,
      totalRecords,
      totalPages,
    },
    data: listResult.rows.map(mapCourseRow),
  };
}

export async function getCourseByIdService(courseId: string) {
  const course = await db.findOne('courses', { course_id: courseId });
  if (!course) return null;
  return mapCourseRow(course);
}

export async function updateCourseService(courseId: string, input: UpdateCourseInput) {
  const existing = await db.findOne('courses', { course_id: courseId });
  if (!existing) throw new Error('Course not found.');

  if (input.instructorId) {
    const instructor = await db.findOne('users', { user_id: input.instructorId });
    if (!instructor) throw new Error('Instructor not found.');
  }

  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.instructorId !== undefined) updates.instructor_id = input.instructorId;

  const fields = Object.keys(updates);
  const values = Object.values(updates);
  const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');

  await pool.query(`UPDATE courses SET ${setClause} WHERE course_id = $${values.length + 1}`, [...values, courseId]);

  const updated = await db.findOne('courses', { course_id: courseId });
  return mapCourseRow(updated);
}

export async function deleteCourseService(courseId: string) {
  const existing = await db.findOne('courses', { course_id: courseId });
  if (!existing) throw new Error('Course not found.');

  await pool.query('DELETE FROM course_enrollments WHERE course_id = $1', [courseId]);
  await pool.query('DELETE FROM courses WHERE course_id = $1', [courseId]);

  logger.info('Course deleted', { course_id: courseId });
  return { message: 'Course deleted successfully' };
}

export async function enrollUserInCourseService(courseId: string, input: EnrollCourseInput) {
  const course = await db.findOne('courses', { course_id: courseId });
  if (!course) throw new Error('Course not found.');

  const user = await db.findOne('users', { user_id: input.userId });
  if (!user) throw new Error('User not found.');

  const existingEnrollment = await pool.query(
    'SELECT enrollment_id FROM course_enrollments WHERE course_id = $1 AND user_id = $2 LIMIT 1',
    [courseId, input.userId]
  );

  if (existingEnrollment.rowCount) {
    throw new Error('User is already enrolled in this course.');
  }

  const enrollmentId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert('course_enrollments', {
    enrollment_id: enrollmentId,
    course_id: courseId,
    user_id: input.userId,
    status: 'ENROLLED',
    progress: 0,
    completed_at: null,
    created_at: now,
    updated_at: now,
  });

  const created = await pool.query(
    `
      SELECT ce.enrollment_id, ce.course_id, ce.user_id, ce.status, ce.progress, ce.completed_at, ce.created_at, ce.updated_at,
             c.title AS course_title
      FROM course_enrollments ce
      LEFT JOIN courses c ON c.course_id = ce.course_id
      WHERE ce.enrollment_id = $1
      LIMIT 1
    `,
    [enrollmentId]
  );

  logger.info('Course enrollment created', { enrollment_id: enrollmentId, course_id: courseId, user_id: input.userId });
  return mapEnrollmentRow(created.rows[0]);
}

export async function listEnrollmentsService(opts: {
  page?: number;
  limit?: number;
  userId?: string;
  courseId?: string;
  status?: 'ENROLLED' | 'COMPLETED' | 'DROPPED';
}) {
  const page = opts.page ?? 1;
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const offset = (page - 1) * limit;

  const whereParts: string[] = [];
  const params: any[] = [];

  if (opts.userId) {
    params.push(opts.userId);
    whereParts.push(`ce.user_id = $${params.length}`);
  }

  if (opts.courseId) {
    params.push(opts.courseId);
    whereParts.push(`ce.course_id = $${params.length}`);
  }

  if (opts.status) {
    params.push(opts.status);
    whereParts.push(`ce.status = $${params.length}`);
  }

  const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const countQuery = `SELECT COUNT(*)::int AS count FROM course_enrollments ce ${whereClause}`;
  const countResult = await pool.query(countQuery, params);
  const totalRecords = Number(countResult.rows[0]?.count ?? 0);
  const totalPages = Math.ceil(totalRecords / limit) || 1;

  const listParams = [...params, limit, offset];
  const listQuery = `
    SELECT ce.enrollment_id, ce.course_id, ce.user_id, ce.status, ce.progress, ce.completed_at, ce.created_at, ce.updated_at,
           c.title AS course_title
    FROM course_enrollments ce
    LEFT JOIN courses c ON c.course_id = ce.course_id
    ${whereClause}
    ORDER BY ce.created_at DESC
    LIMIT $${listParams.length - 1} OFFSET $${listParams.length}
  `;

  const listResult = await pool.query(listQuery, listParams);

  return {
    meta: {
      page,
      limit,
      totalRecords,
      totalPages,
    },
    data: listResult.rows.map(mapEnrollmentRow),
  };
}
