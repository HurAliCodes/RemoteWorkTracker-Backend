import type { PoolClient } from 'pg';
import pool from '../config/db';

export type AuditAction = 'soft_delete' | 'restore' | 'update' | 'create';

export async function writeAuditLog(
	input: {
		entityType: string;
		entityId: string;
		action: AuditAction;
		actorUserId?: string | null;
		actorOrganizationId?: string | null;
		details?: Record<string, unknown> | null;
	},
	client?: PoolClient
) {
	const db = client ?? pool;
	await db.query(
		`INSERT INTO entity_audit_log
		  (entity_type, entity_id, action, actor_user_id, actor_organization_id, details)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		[
			input.entityType,
			input.entityId,
			input.action,
			input.actorUserId ?? null,
			input.actorOrganizationId ?? null,
			input.details ? JSON.stringify(input.details) : null,
		]
	);
}
