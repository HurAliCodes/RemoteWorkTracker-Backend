import { createHash } from 'node:crypto';
import { fetchActivitySegmentsInRange, fetchIdleAggregates } from './telemetry.repository';
import type { TelemetryDetailQuery, TelemetryListQuery } from './telemetry.validation';
import type { ActivityRow } from './telemetry.repository';
import { fetchActivitySegmentsForDay, fetchLatestActivityPerUserForDay } from './telemetry.repository';

/** Oldest/latest activity timestamp per UTC calendar day */
export function dayFirstLastFromActivities(rows: ActivityRow[]): Map<string, { firstIso: string; lastIso: string }> {
	const byDay = new Map<string, { firstT: number; lastT: number; firstIso: string; lastIso: string }>();
	for (const row of rows) {
		const day = utcCalendarDay(row.created_at);
		const t = new Date(row.created_at).getTime();
		const prev = byDay.get(day);
		if (!prev) {
			byDay.set(day, { firstT: t, lastT: t, firstIso: row.created_at, lastIso: row.created_at });
			continue;
		}
		if (t < prev.firstT) {
			prev.firstT = t;
			prev.firstIso = row.created_at;
		}
		if (t > prev.lastT) {
			prev.lastT = t;
			prev.lastIso = row.created_at;
		}
	}
	const out = new Map<string, { firstIso: string; lastIso: string }>();
	for (const [day, v] of byDay) {
		out.set(day, { firstIso: v.firstIso, lastIso: v.lastIso });
	}
	return out;
}

/**
 * Rolling averages over up to maxDays calendar days that have bounds (presence days sorted desc).
 */
export function averageSeenOffsetsUtc(
	dayBounds: Map<string, { firstIso: string; lastIso: string }>,
	sortedDaysDescending: string[],
	policyStartHourUtc: number,
	policyEndHourUtc: number,
	lateGraceMinutes: number,
	maxDays: number
): {
	firstSeenOffsetMinutes: number;
	lastSeenOffsetMinutes: number;
	lateArrivals: number;
} {
	const startMin = Math.min(23, Math.max(0, policyStartHourUtc)) * 60;
	const days = sortedDaysDescending.slice(0, maxDays);
	let sumFirstOff = 0;
	let sumLastOff = 0;
	let n = 0;
	let late = 0;
	const endBoundaryMin = Math.min(23, Math.max(0, policyEndHourUtc)) * 60;
	for (const d of days) {
		const b = dayBounds.get(d);
		if (!b) continue;
		const firstM = minutesSinceUtcMidnight(b.firstIso);
		const lastM = minutesSinceUtcMidnight(b.lastIso);
		const firstOffset = Math.max(0, firstM - startMin);
		const lastOffset = Math.max(0, endBoundaryMin - lastM);
		sumFirstOff += firstOffset;
		sumLastOff += Math.max(0, lastOffset);
		n++;
		if (firstM > startMin + lateGraceMinutes) {
			late++;
		}
	}
	const div = Math.max(n, 1);
	return {
		firstSeenOffsetMinutes: Math.round(sumFirstOff / div),
		lastSeenOffsetMinutes: Math.round(sumLastOff / div),
		lateArrivals: late,
	};
}

/** Exported for snapshots that mirror daily aggregation semantics. */
export function utcCalendarDay(isoUtc: string): string {
  return new Date(isoUtc).toISOString().slice(0, 10);
}

/** Gini coefficient on sorted nonnegative values (0 = equal lengths, higher = more unequal segment times). */
export function giniCoefficient(values: number[]): number {
	const v = values.filter((x) => x >= 0).sort((a, b) => a - b);
	if (v.length === 0) return 0;
	const sum = v.reduce((s, x) => s + x, 0);
	if (sum <= 0) return 0;
	let acc = 0;
	for (let i = 0; i < v.length; i++) {
		acc += (i + 1) * v[i]!;
	}
	const n = v.length;
	return (2 * acc) / (n * sum) - (n + 1) / n;
}

/** Minutes since UTC midnight for an ISO timestamp. */
export function minutesSinceUtcMidnight(iso: string): number {
	const d = new Date(iso);
	return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function parseDurationFromDescription(description: string | null): number {
  if (!description || typeof description !== 'string') return 0;
  const t = description.trim();
  if (!t.startsWith('{')) return 0;
  try {
    const parsed = JSON.parse(t) as Record<string, unknown>;
    const d = parsed.duration;
    if (typeof d === 'number' && Number.isFinite(d) && d >= 0) return Math.floor(d);
    return 0;
  } catch {
    return 0;
  }
}

type DailyKey = string;

export interface DailyTelemetryRow {
  userId: string;
  name: string | null;
  day: string;
  firstSeen: string | null;
  lastSeen: string | null;
  activeSeconds: number;
  idleSeconds: number;
  segmentCount: number;
  syntheticAttendanceId: string;
}

function deterministicSyntheticId(organizationId: string, userId: string, day: string): string {
  return deterministicUuidFromString(`agent-att|${organizationId}|${userId}|${day}`);
}

/** RFC 4122–style deterministic UUID from a string (SHA-256, version bits set). */
function deterministicUuidFromString(input: string): string {
  const buf = createHash('sha256').update(input).digest();
  buf[6] = (buf[6]! & 0x0f) | 0x40;
  buf[8] = (buf[8]! & 0x3f) | 0x80;
  const h = buf.subarray(0, 16).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function utcDayStart(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function utcTodayYMD(): string {
  return new Date().toISOString().slice(0, 10);
}

function clampRange(startDate?: string, endDate?: string): { start: Date; exclusiveEnd: Date } {
  const endYmd = endDate || utcTodayYMD();
  const endStart = utcDayStart(endYmd);
  const exclusiveEnd = new Date(endStart.getTime() + 24 * 60 * 60 * 1000);
  let start =
    startDate != null ? utcDayStart(startDate) : new Date(endStart.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (start >= exclusiveEnd) {
    start = new Date(endStart.getTime());
  }
  return { start, exclusiveEnd };
}

export async function getDailyTelemetry(orgId: string, q: TelemetryListQuery) {
  const { start, exclusiveEnd } = clampRange(q.startDate, q.endDate);

  const [activities, idles] = await Promise.all([
    fetchActivitySegmentsInRange({
      organizationId: orgId,
      userId: q.userId || undefined,
      start,
      end: exclusiveEnd,
    }),
    fetchIdleAggregates({
      organizationId: orgId,
      userId: q.userId || undefined,
      start,
      end: exclusiveEnd,
    }),
  ]);

  const agg = new Map<
    DailyKey,
    {
      userId: string;
      name: string | null;
      day: string;
      firstSeen: string | null;
      lastSeen: string | null;
      activeSeconds: number;
      segmentCount: number;
    }
  >();

  const keyOf = (userId: string, day: string) => `${userId}::${day}` as DailyKey;

  for (const row of activities) {
    const day = utcCalendarDay(row.created_at);
    const k = keyOf(row.user_id, day);
    const prev = agg.get(k);
    const dur = parseDurationFromDescription(row.description);
    const ts = new Date(row.created_at).getTime();

    if (!prev) {
      agg.set(k, {
        userId: row.user_id,
        name: row.name,
        day,
        firstSeen: row.created_at,
        lastSeen: row.created_at,
        activeSeconds: dur,
        segmentCount: 1,
      });
    } else {
      const firstMs = prev.firstSeen ? new Date(prev.firstSeen).getTime() : ts;
      const lastMs = prev.lastSeen ? new Date(prev.lastSeen).getTime() : ts;
      agg.set(k, {
        ...prev,
        name: prev.name || row.name,
        firstSeen: ts < firstMs ? row.created_at : prev.firstSeen,
        lastSeen: ts > lastMs ? row.created_at : prev.lastSeen,
        activeSeconds: prev.activeSeconds + dur,
        segmentCount: prev.segmentCount + 1,
      });
    }
  }

  const idleMap = new Map<DailyKey, { idleSeconds: number; name: string | null }>();
  for (const ir of idles) {
    const k = keyOf(ir.user_id, ir.day);
    idleMap.set(k, {
      idleSeconds: parseInt(ir.idle_seconds, 10) || 0,
      name: ir.name,
    });
  }

  const rows: DailyTelemetryRow[] = [];
  const seenKeys = new Set<DailyKey>();

  for (const [k, v] of agg.entries()) {
    seenKeys.add(k);
    rows.push({
      userId: v.userId,
      name: v.name,
      day: v.day,
      firstSeen: v.firstSeen,
      lastSeen: v.lastSeen,
      activeSeconds: v.activeSeconds,
      idleSeconds: idleMap.get(k)?.idleSeconds || 0,
      segmentCount: v.segmentCount,
      syntheticAttendanceId: deterministicSyntheticId(orgId, v.userId, v.day),
    });
  }

  for (const [k, idle] of idleMap.entries()) {
    if (seenKeys.has(k)) continue;
    const [userId, day] = k.split('::');
    rows.push({
      userId,
      name: idle.name,
      day,
      firstSeen: null,
      lastSeen: null,
      activeSeconds: 0,
      idleSeconds: idle.idleSeconds,
      segmentCount: 0,
      syntheticAttendanceId: deterministicSyntheticId(orgId, userId, day),
    });
  }

  rows.sort((a, b) => {
    const d = b.day.localeCompare(a.day);
    if (d !== 0) return d;
    return (a.name || a.userId).localeCompare(b.name || b.userId);
  });

  const page = q.page || 1;
  const limit = q.limit || 50;
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startIdx = (page - 1) * limit;
  const slice = rows.slice(startIdx, startIdx + limit);

  return {
    data: slice,
    meta: { page, limit, totalRecords: total, totalPages },
  };
}

export async function getActivityDetail(orgId: string, q: TelemetryDetailQuery) {
  const dayStart = new Date(`${q.day}T00:00:00.000Z`);
  const dayEnd = new Date(`${q.day}T23:59:59.999Z`);
  dayEnd.setMilliseconds(dayEnd.getMilliseconds() + 1);

  const page = q.page || 1;
  const limit = q.limit || 100;
  const offset = (page - 1) * limit;

  const { rows, total } = await fetchActivitySegmentsForDay({
    organizationId: orgId,
    userId: q.userId,
    dayStart,
    dayEnd,
    limit,
    offset,
    hourStartUtc: q.windowStartHourUtc,
    hourEndUtc: q.windowEndHourUtc,
  });

  const segments = rows.map((r: ActivityRow) => ({
    userId: r.user_id,
    name: r.name,
    createdAt: r.created_at,
    action: r.action,
    deviceId: r.device_id,
    description: r.description,
    durationSeconds: parseDurationFromDescription(r.description),
    windowTitle: extractWindowTitle(r.description),
    appLabel: extractAppLabel(r.description),
  }));

  return {
    userId: q.userId,
    day: q.day,
    data: segments,
    meta: { page, limit, totalRecords: total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** Org-wide application time totals for one UTC calendar day (seconds per app label). */
export async function getActivityAppsByDayForOrg(organizationId: string, day: string) {
  const dayStart = new Date(`${day}T00:00:00.000Z`);
  const exclusiveEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const rows = await fetchActivitySegmentsInRange({
    organizationId,
    start: dayStart,
    end: exclusiveEnd,
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    const label = extractAppLabel(r.description) || r.action || 'Activity';
    map.set(label, (map.get(label) || 0) + parseDurationFromDescription(r.description));
  }
  const data = [...map.entries()]
    .map(([appLabel, totalSeconds]) => ({ appLabel, totalSeconds }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds);
  return { day, data };
}

/** Latest desk row per user for a UTC day (for “current app” badges). */
export async function getLatestDeskAppsForDay(organizationId: string, day: string, userId?: string) {
  const dayStart = new Date(`${day}T00:00:00.000Z`);
  const exclusiveEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const rows = await fetchLatestActivityPerUserForDay({
    organizationId,
    dayStart,
    dayEnd: exclusiveEnd,
    userId,
  });
  const data = rows.map((r) => ({
    userId: r.user_id,
    name: r.name,
    appLabel: extractAppLabel(r.description) || r.action || null,
    windowTitle: extractWindowTitle(r.description),
    lastSeenAt: r.created_at,
  }));
  return { day, data };
}

function extractWindowTitle(description: string | null): string | null {
  if (!description) return null;
  try {
    const j = JSON.parse(description) as Record<string, unknown>;
    return typeof j.windowTitle === 'string' ? j.windowTitle : null;
  } catch {
    return null;
  }
}

function extractAppLabel(description: string | null): string | null {
  if (!description) return null;
  try {
    const j = JSON.parse(description) as Record<string, unknown>;
    return typeof j.app === 'string' ? j.app : null;
  } catch {
    return null;
  }
}

/** Facade rows for deprecated GET /attendance list (camelCase/snake compat). */
export function toAttendanceLikeRows(rows: DailyTelemetryRow[]) {
  return rows.map((r) => {
    const wh = Number((Math.max(0, r.activeSeconds) / 3600).toFixed(4));

    return {
      attendanceId: r.syntheticAttendanceId,
      attendance_id: r.syntheticAttendanceId,
      userId: r.userId,
      user_id: r.userId,
      name: r.name,
      day: r.day,
      check_in: r.firstSeen,
      checkIn: r.firstSeen,
      check_out: r.lastSeen,
      checkOut: r.lastSeen,
      status: 'AGENT_DESK' as const,
      workedHours: Number.isFinite(wh) ? wh : 0,
      worked_hours: Number.isFinite(wh) ? wh : 0,
      activeSeconds: r.activeSeconds,
      active_seconds: r.activeSeconds,
      idleSeconds: r.idleSeconds,
      idle_seconds: r.idleSeconds,
      segmentCount: r.segmentCount,
      segment_count: r.segmentCount,
      created_at: `${r.day}T00:00:00.000Z`,
      createdAt: `${r.day}T00:00:00.000Z`,
      source: 'agent_telemetry',
    };
  });
}
