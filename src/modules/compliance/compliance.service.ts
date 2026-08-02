import * as repo from './compliance.repository';

function mapRule(row: any) {
  return {
    ruleId: row.rule_id,
    region: row.region,
    maxWeeklyHours: Number(row.max_weekly_hours),
    overtimeAllowed: Boolean(row.overtime_allowed),
    minBreakHours: Number(row.min_break_hours ?? 0),
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapViolation(row: any) {
  return {
    violationId: row.violation_id,
    userId: row.user_id,
    ruleId: row.rule_id,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export async function createComplianceRuleService(organizationId: string, body: any) {
  const row = await repo.createRule({
    organizationId,
    region: body.region,
    maxWeeklyHours: body.maxWeeklyHours,
    overtimeAllowed: body.overtimeAllowed ?? true,
    minBreakHours: body.minBreakHours ?? 11,
    description: body.description,
  });
  return mapRule(row);
}

export async function listComplianceRulesService(
  organizationId: string,
  opts: { region?: string; page?: number; limit?: number }
) {
  const page = opts.page ?? 1;
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const result = await repo.listRules(organizationId, { region: opts.region, page, limit });
  return {
    meta: {
      page: result.page,
      limit: result.limit,
      totalRecords: result.totalRecords,
      totalPages: result.totalPages,
    },
    data: result.rows.map(mapRule),
  };
}

export async function updateComplianceRuleService(organizationId: string, ruleId: string, body: any) {
  const updates: Record<string, unknown> = {};
  if (body.region !== undefined) updates.region = body.region;
  if (body.maxWeeklyHours !== undefined) updates.max_weekly_hours = body.maxWeeklyHours;
  if (body.overtimeAllowed !== undefined) updates.overtime_allowed = body.overtimeAllowed;
  if (body.minBreakHours !== undefined) updates.min_break_hours = body.minBreakHours;
  if (body.description !== undefined) updates.description = body.description;
  const row = await repo.updateRule(ruleId, organizationId, updates);
  if (!row) throw new Error('Compliance rule not found');
  return mapRule(row);
}

export async function deleteComplianceRuleService(organizationId: string, ruleId: string) {
  const ok = await repo.deleteRule(ruleId, organizationId);
  if (!ok) throw new Error('Compliance rule not found');
  return { message: 'Compliance rule deleted successfully' };
}

export async function listComplianceViolationsService(
  organizationId: string,
  opts: {
    userId?: string;
    region?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }
) {
  const page = opts.page ?? 1;
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const result = await repo.listViolations(organizationId, { ...opts, page, limit });
  return {
    meta: {
      page: result.page,
      limit: result.limit,
      totalRecords: result.totalRecords,
      totalPages: result.totalPages,
    },
    data: result.rows.map(mapViolation),
  };
}

export async function resolveComplianceViolationService(organizationId: string, violationId: string) {
  const row = await repo.resolveViolation(violationId, organizationId);
  if (!row) throw new Error('Violation not found');
  return mapViolation(row);
}

export async function acknowledgeComplianceRuleService(
  userId: string,
  ruleId: string,
  signatureData: string,
  organizationId: string
) {
  const rule = await repo.findRule(ruleId, organizationId);
  if (!rule) throw new Error('Compliance rule not found');
  await repo.acknowledgeRule(userId, ruleId, signatureData);
  return { message: 'Rule acknowledged', ruleId };
}
