import { withDatabase } from './utils/db';

/** Additive schema upgrades for compliance, performance, attendance geo, FCM, payroll uniqueness. */
export default async function migrateSchemaUpgrades() {
  await withDatabase(async (client) => {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // --- Compliance rules ---
    await client.query(`
      ALTER TABLE compliance_rules
        ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(organization_id),
        ADD COLUMN IF NOT EXISTS region VARCHAR(64),
        ADD COLUMN IF NOT EXISTS max_weekly_hours NUMERIC(6,2),
        ADD COLUMN IF NOT EXISTS overtime_allowed BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS min_break_hours NUMERIC(6,2);
    `);
    await client.query(`
      ALTER TABLE compliance_rules ALTER COLUMN description DROP NOT NULL;
    `).catch(() => undefined);
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_compliance_rules_organization_id ON compliance_rules(organization_id)'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_compliance_rules_region ON compliance_rules(region)'
    );

    // --- Compliance violations ---
    await client.query(`
      ALTER TABLE compliance_violations
        ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(organization_id),
        ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
    `);
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_compliance_violations_organization_id ON compliance_violations(organization_id)'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_compliance_violations_status ON compliance_violations(status)'
    );

    // --- Performance reviews ---
    await client.query(`
      ALTER TABLE performance_reviews
        ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(organization_id),
        ADD COLUMN IF NOT EXISTS period VARCHAR(16),
        ADD COLUMN IF NOT EXISTS attendance_score NUMERIC(5,2),
        ADD COLUMN IF NOT EXISTS task_completion_score NUMERIC(5,2),
        ADD COLUMN IF NOT EXISTS goal_progress_score NUMERIC(5,2),
        ADD COLUMN IF NOT EXISTS wellness_score NUMERIC(5,2),
        ADD COLUMN IF NOT EXISTS overall_score NUMERIC(5,2),
        ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'DRAFT',
        ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS signature_data TEXT,
        ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
    `);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_performance_reviews_user_period'
        ) THEN
          ALTER TABLE performance_reviews
            ADD CONSTRAINT uq_performance_reviews_user_period UNIQUE (user_id, period);
        END IF;
      END$$;
    `);

    // --- Attendance geo ---
    await client.query(`
      ALTER TABLE attendance
        ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS ip_address VARCHAR(64),
        ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'CHECKED_IN';
    `);
    // device_id may be UUID FK — allow string device ids from agents by dropping FK if needed is risky;
    // keep as-is; check-in may leave device_id null.

    // --- Geo fences ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS organization_geo_fences (
        fence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        radius_meters NUMERIC(12,2) NOT NULL CHECK (radius_meters > 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_geo_fences_organization_id ON organization_geo_fences(organization_id)'
    );

    // --- FCM tokens ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS device_push_tokens (
        token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        platform VARCHAR(32),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_device_push_tokens_token UNIQUE (token)
      );
    `);
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user_id ON device_push_tokens(user_id)'
    );

    // --- Compliance acknowledgements (signatures) ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS compliance_acknowledgements (
        ack_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        rule_id UUID NOT NULL REFERENCES compliance_rules(rule_id) ON DELETE CASCADE,
        signature_data TEXT NOT NULL,
        signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_compliance_ack_user_rule UNIQUE (user_id, rule_id)
      );
    `);

    // --- Org password resets (no FK to users) ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS org_password_resets (
        organization_id UUID PRIMARY KEY REFERENCES organizations(organization_id) ON DELETE CASCADE,
        reset_token VARCHAR(12) NOT NULL,
        expires_at TIMESTAMP NOT NULL
      );
    `);

    // --- Payroll uniqueness ---
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_payroll_user_period'
        ) THEN
          ALTER TABLE payroll
            ADD CONSTRAINT uq_payroll_user_period UNIQUE (user_id, period_start, period_end);
        END IF;
      END$$;
    `);

    // --- Devices refresh revoke ---
    await client.query(`
      ALTER TABLE devices
        ADD COLUMN IF NOT EXISTS refresh_token_hash TEXT;
    `);

    // --- Notifications optional delivery cols ---
    await client.query(`
      ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS title VARCHAR(255),
        ADD COLUMN IF NOT EXISTS fcm_sent BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
    `);

    // --- P1: soft-delete ---
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS deleted_by UUID;
    `);
    await client.query(`
      ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS deleted_by UUID;
    `);
    await client.query(`
      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS deleted_by UUID;
    `);
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at)'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at)'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at)'
    );

    // --- P1: unique constraints ---
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_course_enrollments_course_user'
        ) THEN
          ALTER TABLE course_enrollments
            ADD CONSTRAINT uq_course_enrollments_course_user UNIQUE (course_id, user_id);
        END IF;
      END$$;
    `);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_project_members_project_user'
        ) THEN
          ALTER TABLE project_members
            ADD CONSTRAINT uq_project_members_project_user UNIQUE (project_id, user_id);
        END IF;
      END$$;
    `);

    // --- P1: audit trail ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS entity_audit_log (
        audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type VARCHAR(64) NOT NULL,
        entity_id UUID NOT NULL,
        action VARCHAR(32) NOT NULL,
        actor_user_id UUID,
        actor_organization_id UUID,
        details JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_entity_audit_log_entity ON entity_audit_log(entity_type, entity_id)'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_entity_audit_log_created_at ON entity_audit_log(created_at)'
    );

    // --- P1: idempotency keys (agent activity batches, etc.) ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        scope VARCHAR(64) NOT NULL,
        key TEXT NOT NULL,
        request_hash TEXT,
        response_json JSONB,
        device_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (scope, key)
      );
    `);
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at ON idempotency_keys(created_at)'
    );

    // --- P1: migration ledger (single ordered migrator tracking) ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(
      `INSERT INTO schema_migrations (id) VALUES ('p1-data-integrity')
       ON CONFLICT (id) DO NOTHING`
    );

    // --- AI production: durable jobs + sync freshness ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_runs (
        run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_name VARCHAR(64) NOT NULL,
        schedule_key VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'running',
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ,
        meta JSONB NOT NULL DEFAULT '{}'::jsonb,
        CONSTRAINT uq_job_runs_schedule UNIQUE (job_name, schedule_key)
      );
    `);
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_job_runs_started_at ON job_runs(started_at DESC)'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_job_runs_status ON job_runs(status)'
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_sync_state (
        organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        last_synced_at TIMESTAMPTZ,
        source_freshness_at TIMESTAMPTZ,
        last_status VARCHAR(32),
        last_error TEXT,
        last_report_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (organization_id, user_id)
      );
    `);
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_ai_sync_state_synced ON ai_sync_state(last_synced_at DESC)'
    );

    // Optional freshness columns on analytics_results if the table exists
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'analytics_results'
        ) THEN
          ALTER TABLE analytics_results
            ADD COLUMN IF NOT EXISTS source_freshness_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS scoring_mode VARCHAR(32),
            ADD COLUMN IF NOT EXISTS rule_engine_version VARCHAR(32),
            ADD COLUMN IF NOT EXISTS model_version VARCHAR(64),
            ADD COLUMN IF NOT EXISTS confidence NUMERIC(5,4),
            ADD COLUMN IF NOT EXISTS request_id VARCHAR(128);
        END IF;
      END$$;
    `);

    await client.query(
      `INSERT INTO schema_migrations (id) VALUES ('ai-production-jobs')
       ON CONFLICT (id) DO NOTHING`
    );

    console.log('Schema upgrades migrated successfully.');
  });
}
