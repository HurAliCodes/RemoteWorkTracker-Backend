import {
  createWellnessLog,
  listWellnessLogs,
  WellnessDbRow,
  WellnessFilters,
} from './wellness.repository';
import {
  CreateWellnessLogInput,
  ListMyWellnessLogsQuery,
  ListWellnessLogsQuery,
  MoodType,
} from './wellness.validation';

interface WellnessApiModel {
  logId: string;
  userId: string;
  date: string;
  mood: MoodType | null;
  energyLevel: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  name?: string | null;
}

const toApiModel = (row: WellnessDbRow, includeName: boolean): WellnessApiModel => {
  const baseModel: WellnessApiModel = {
    logId: row.log_id,
    userId: row.user_id,
    date: row.date,
    mood: row.mood,
    energyLevel: row.energy_level,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (includeName) {
    baseModel.name = row.name ?? null;
  }

  return baseModel;
};

export const createWellnessLogService = async (userId: string, payload: CreateWellnessLogInput) => {
  const created = await createWellnessLog({
    userId,
    date: payload.date,
    mood: payload.mood,
    energyLevel: payload.energyLevel,
    notes: payload.notes,
  });

  return toApiModel(created, false);
};

const buildPaginatedResponse = (
  result: { totalRecords: number; rows: WellnessDbRow[] },
  page: number,
  limit: number,
  includeName: boolean,
) => {
  const totalPages = Math.max(1, Math.ceil(result.totalRecords / limit));

  return {
    meta: {
      page,
      limit,
      totalRecords: result.totalRecords,
      totalPages,
    },
    data: result.rows.map((row) => toApiModel(row, includeName)),
  };
};

export const getWellnessLogsService = async (query: ListWellnessLogsQuery) => {
  const filters: WellnessFilters = {
    userId: query.userId,
    organizationId: query.organizationId,
    startDate: query.startDate,
    endDate: query.endDate,
    mood: query.mood,
    minEnergy: query.minEnergy,
    maxEnergy: query.maxEnergy,
    page: query.page,
    limit: query.limit,
  };

  const result = await listWellnessLogs(filters);
  return buildPaginatedResponse(result, query.page, query.limit, true);
};

export const getMyWellnessLogsService = async (userId: string, query: ListMyWellnessLogsQuery) => {
  const filters: WellnessFilters = {
    userId,
    startDate: query.startDate,
    endDate: query.endDate,
    mood: query.mood,
    minEnergy: query.minEnergy,
    maxEnergy: query.maxEnergy,
    page: query.page,
    limit: query.limit,
  };

  const result = await listWellnessLogs(filters);
  return buildPaginatedResponse(result, query.page, query.limit, false);
};
