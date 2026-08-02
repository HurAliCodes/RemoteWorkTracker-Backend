# Remote Work Tracker – Backend

Express + TypeScript API for the remote work portal (orgs, users, projects, tasks, attendance, payroll, compliance, performance, agent telemetry, AI sync).

## Stack

- **Runtime:** Node 18+, TypeScript (`ts-node` / `nodemon`)
- **HTTP:** Express (`src/server.ts` → `src/app.ts`)
- **DB:** PostgreSQL via `pg` (`src/config/db.ts`)
- **Auth:** JWT (`authenticateJWT` + `resolveCallerOrganizationId` + `requireOrgAdmin` / `requireManagerOrAdmin`)
- **Jobs:** `node-cron` (`src/jobs/scheduler.ts`) — daily compliance scan + weekday notification digest
- **Push:** optional `firebase-admin` FCM (`src/services/fcm.service.ts`)

## Local development

```bash
cd backend
cp .env.example .env   # fill DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
npm install
npm run migrate
npm run dev            # http://localhost:5000
```

Optional: `npm run seed`, `npm run worker:ai`, `npm test`, `npm run openapi:generate`.

## Docker Compose

```bash
docker compose up --build
```

Publishes API on **5000**, Postgres on host **5434**, RabbitMQ **5672/15672**, Redis **6379**. Internal DB URL uses `db:5432`.

## Main API mounts (`/api/v1`)

| Mount | Notes |
|-------|--------|
| `/organizations` | Signup, login, refresh, admin user CRUD (auth required for register/users) |
| `/roles`, `/departments` | JWT + admin for mutations |
| `/projects`, `/tasks` | JWT; scoped to caller organization |
| `/goals`, `/courses`, `/payroll` | JWT; payroll generate is admin + org-scoped |
| `/attendance` | Telemetry views + `POST /check-in` / `POST /check-out` + geo-fences |
| `/compliance` | Rules CRUD, violations, acknowledgements (signatures) |
| `/performance` | Generate / list / finalize (+ optional signature) |
| `/notifications` | Inbox + `POST/DELETE /push-token` |
| `/agent` | Pairing-code register; heartbeat/activity/idle require device JWT |
| `/analytics`, `/dashboard`, `/telemetry`, `/ai`, `/wellness`, `/users` | Existing modules |

## Digital signatures

In-app only (not DocuSign): base64 / typed signature on **performance finalize** and **compliance rule acknowledge**.

## Attendance dual model

1. **Manual check-in/out** — mobile/web with lat/lon/IP and optional geo-fence enforcement (`attendance` table).
2. **Agent desk telemetry** — device heartbeats/activity mapped into attendance-like views for managers.

## Environment

See [`.env.example`](.env.example). Required: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`. Optional: Firebase FCM keys, `REDIS_URL`, `RABBITMQ_URL`, AI service credentials.

## Docs

- Swagger UI: `/docs/`
- Module API notes: [`docs/APIS/`](docs/APIS/)
- Ports: repo root [`PORTS.md`](../PORTS.md)
