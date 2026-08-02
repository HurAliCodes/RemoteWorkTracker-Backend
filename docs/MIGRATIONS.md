# Database migrations

## Single entry point

Run from `backend/`:

```bash
npm run migrate
```

This executes `scripts/migrate.ts` in a fixed order (base tables → `migrate-schema-upgrades.ts`).

Additive / evolving schema (soft-delete, uniques, idempotency, audit) lives in **`scripts/migrate-schema-upgrades.ts`** only. Do not add new one-off DDL scripts for production schema.

## Ledger

`schema_migrations` records applied upgrade packs (e.g. `p1-data-integrity`). Base `CREATE TABLE IF NOT EXISTS` scripts remain idempotent without per-file ledger rows.

## Deprecated aliases

These npm scripts remain for local convenience but are redundant with `npm run migrate`:

- `migrate:tasks-deadline` → already covered by `migrate-tasks` / upgrades
- `migrate:idle_logs` → already covered by `migrate-idle_logs` in the main chain
