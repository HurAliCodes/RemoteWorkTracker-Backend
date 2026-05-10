import pool from '../../config/db';
import { MoodType } from './wellness.validation';

export interface WellnessDbRow {
  log_id: string;
  user_id: string;
  date: string;
  mood: MoodType | null;
  energy_level: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  name?: string | null;
}

export interface WellnessFilters {
  userId?: string;
  organizationId?: string;
  startDate?: string;
  endDate?: string;
  mood?: string;
  minEnergy?: number;
  maxEnergy?: number;
  page: number;
  limit: number;
}

const buildFilterClause = (filters: WellnessFilters) => {
  const conditions: string[] = [];
  const values: Array<string | number> = [];

  if (filters.userId) {
    values.push(filters.userId);
    conditions.push(`wl.user_id = $${values.length}`);
  }

  if (filters.organizationId) {
    values.push(filters.organizationId);
    conditions.push(`u.organization_id = $${values.length}`);
  }

  if (filters.startDate) {
    values.push(filters.startDate);
    conditions.push(`wl.date >= $${values.length}`);
  }

  if (filters.endDate) {
    values.push(filters.endDate);
    conditions.push(`wl.date <= $${values.length}`);
  }

  if (filters.mood) {
    values.push(filters.mood);
    conditions.push(`wl.mood = $${values.length}`);
  }

  if (filters.minEnergy !== undefined) {
    values.push(filters.minEnergy);
    conditions.push(`wl.energy_level >= $${values.length}`);
  }

  if (filters.maxEnergy !== undefined) {
    values.push(filters.maxEnergy);
    conditions.push(`wl.energy_level <= $${values.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, values };
};

export const createWellnessLog = async (data: {
  userId: string;
  date: string;
  mood?: string;
  energyLevel?: number;
  notes?: string;
}) => {
  const result = await pool.query<WellnessDbRow>(
    `
      INSERT INTO wellness_logs (user_id, date, mood, energy_level, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING log_id, user_id, date, mood, energy_level, notes, created_at, updated_at
    `,
    [data.userId, data.date, data.mood ?? null, data.energyLevel ?? null, data.notes ?? null],
  );

  return result.rows[0];
};

export const listWellnessLogs = async (filters: WellnessFilters) => {
  const { whereClause, values } = buildFilterClause(filters);

  const countResult = await pool.query<{ total: string }>(
    `
      SELECT COUNT(*)::text AS total
      FROM wellness_logs wl
      LEFT JOIN users u ON u.user_id = wl.user_id
      ${whereClause}
    `,
    values,
  );

  const offset = (filters.page - 1) * filters.limit;
  const dataValues = [...values, filters.limit, offset];

  const dataResult = await pool.query<WellnessDbRow>(
    `
      SELECT wl.log_id, wl.user_id, wl.date, wl.mood, wl.energy_level, wl.notes, wl.created_at, wl.updated_at, u.name
      FROM wellness_logs wl
      LEFT JOIN users u ON u.user_id = wl.user_id
      ${whereClause}
      ORDER BY wl.date DESC, wl.created_at DESC
      LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}
    `,
    dataValues,
  );

  return {
    totalRecords: Number(countResult.rows[0]?.total ?? 0),
    rows: dataResult.rows,
  };
};
