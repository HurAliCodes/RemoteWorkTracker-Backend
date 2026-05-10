# Agent telemetry vs other modules

## Attendance UI and APIs

Attendance in the web app is **agent-only**: time on desk is derived from **`activity_logs`** (window/application segments sent by the Go agent) and **`idle_logs`** (idle time aggregates). Canonical read APIs:

- `GET /api/v1/telemetry/agent/daily` — per user, per UTC calendar day: first/last activity timestamps, summed active duration (from JSON `description.duration` where present), idle seconds from `idle_logs`, segment counts.
- `GET /api/v1/telemetry/agent/activity-detail` — paginated segment list for a user and day (drill-down).

`GET /api/v1/attendance` (list / `me`) is a **compatibility façade** that exposes telemetry-shaped rows as `attendanceLogs` plus pagination `meta`; it does **not** require manual check-ins for those responses. Legacy rows in the `attendance` table remain for backward compatibility where still used.

## Payroll (future integration)

Payroll generation should **not** depend on manual check-in rows for “hours worked” once payroll is wired to telemetry. The stable contract will be **telemetry summaries** — e.g. daily or monthly rollups of `active_seconds` / `idle_seconds` per user in an organization — surfaced either via an extension of `/api/v1/telemetry/agent/daily` with period aggregation or a dedicated rollup endpoint. Existing payroll APIs may continue to evolve; migrate consumers to telemetry rollups deliberately in a dedicated change.

## Wellbeing vs idle

**`idle_logs`** are **technical agent signals** (machine idle detection) used for attendance and AI snapshots. **`wellbeing_logs`** (and related wellness APIs) are a **separate product surface** — self-report or curated wellness data. Do not assume idle time from the agent substitutes for wellbeing metrics unless a future dashboard explicitly correlates them in product spec and privacy review.

## AI server (Python)

The Node backend remains the **canonical rollup** for telemetry. `getAiEmployeeSnapshotFromTelemetry` (`attendance.repository.ts`) mirrors the same window and duration rules as telemetry APIs, producing `workingHours` / `idleHours`, **distinct days with agent data** as `attendanceDays`, segmentation stats, and UTC policy offsets. Those fields are mapped to the FastAPI AI service (`POST /api/v1/employee/data`, `POST /api/v1/analytics/report`) as snake_case (`active_seconds`, `segment_count`, `focus_fragmentation_index`, etc.). When the app uses agent-only attendance, **`attendance_days` in AI payloads means calendar days with telemetry**, not manual check-ins.

Optional env (backend): `AI_SNAPSHOT_POLICY_START_HOUR_UTC`, `AI_SNAPSHOT_POLICY_END_HOUR_UTC`, `AI_SNAPSHOT_ROLLUP_DAYS`, `AI_SNAPSHOT_LATE_GRACE_MINUTES` (see `src/config/env.ts`).

**Connectivity tests:** Jest suites under `src/modules/ai/*.test.ts` cover `fetch` contracts and `/api/v1/ai` route wiring (mocked). Manual probe: `npx ts-node scripts/check-ai-connection.ts` from `backend/` (requires running AI server + matching `AI_SERVICE_CLIENT_*` / `SERVICE_CLIENT_*` credentials).
