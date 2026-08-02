import fs from 'fs';
import path from 'path';
import { z } from 'zod';

// Zod v4 ships with a built-in JSON Schema converter (`z.toJSONSchema`).
// We use the loose ZodType type since exported schemas in this project are
// plain `z.object(...)` etc., which all extend ZodType.
type AnyZodSchema = z.ZodType<unknown>;

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

type JsonSchema = Record<string, unknown>;

type ResponseObject = {
	description: string;
	content?: { 'application/json': { schema: JsonSchema } };
};

type Operation = {
	tags: string[];
	summary: string;
	operationId?: string;
	description?: string;
	security?: { bearerAuth: [] }[];
	parameters?: Array<{
		name: string;
		in: 'path' | 'query' | 'header' | 'cookie';
		required?: boolean;
		description?: string;
		schema: JsonSchema;
	}>;
	requestBody?: {
		required?: boolean;
		content: { 'application/json': { schema: JsonSchema } };
	};
	responses: Record<string, ResponseObject>;
};

type TagObject = { name: string; description?: string };

type OpenApiSpec = {
	openapi: '3.0.3';
	info: { title: string; version: string; description?: string; contact?: Record<string, string> };
	servers: { url: string; description?: string }[];
	tags: TagObject[];
	components: {
		securitySchemes: {
			bearerAuth: { type: 'http'; scheme: 'bearer'; bearerFormat: 'JWT' };
		};
		schemas: Record<string, JsonSchema>;
	};
	security: { bearerAuth: [] }[];
	paths: Record<string, Partial<Record<HttpMethod, Operation>>>;
};

function normalizePath(base: string, route: string) {
	const full = `${base}/${route}`.replace(/\/+/g, '/');
	let withSlash = full.startsWith('/') ? full : `/${full}`;
	// Convert Express ":id" to OpenAPI "{id}".
	withSlash = withSlash.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
	// Drop trailing slash (except the root) so "/api/v1/roles/" -> "/api/v1/roles".
	if (withSlash.length > 1) withSlash = withSlash.replace(/\/+$/, '');
	return withSlash;
}

/** operationId: stable, unique, camel-ish token derived from method + path. */
function makeOperationId(method: HttpMethod, fullPath: string): string {
	const parts = fullPath
		.split('/')
		.filter(Boolean)
		.map((seg) => seg.replace(/[{}]/g, '').replace(/[^A-Za-z0-9]+/g, '_'));
	const tail = parts
		.map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
		.join('');
	return `${method}${tail ? tail.charAt(0).toUpperCase() + tail.slice(1) : 'Root'}`;
}

function humanize(segment: string): string {
	return segment.replace(/[-_]/g, ' ').trim();
}

const IRREGULAR_SINGULARS: Record<string, string> = {
	analytics: 'analytics',
	wellness: 'wellness',
	payroll: 'payroll',
	compliance: 'compliance',
	performance: 'performance',
	telemetry: 'telemetry',
	progress: 'progress',
	people: 'person',
};

function singularize(word: string): string {
	const known = IRREGULAR_SINGULARS[word.toLowerCase()];
	if (known) return known;
	if (/ies$/.test(word)) return word.replace(/ies$/, 'y');
	// "classes" -> "class", "boxes" -> "box"; but "courses" -> "course".
	if (/(sses|xes|zes|ches|shes)$/.test(word)) return word.replace(/es$/, '');
	if (/ss$/.test(word)) return word;
	if (/s$/.test(word)) return word.replace(/s$/, '');
	return word;
}

/** Professional default summary for any route lacking an explicit override. */
function defaultSummary(method: HttpMethod, fullPath: string, tag: string): string {
	const segs = fullPath.split('/').filter(Boolean);
	const last = segs[segs.length - 1] || '';
	const prev = segs[segs.length - 2] || '';
	const endsWithParam = /^\{.*\}$/.test(last);
	const resource = humanize(tag);
	const singular = singularize(resource);

	// Sub-resource collection, e.g. /projects/{id}/members
	const subResource = !endsWithParam && last && last !== tag ? humanize(last) : null;
	const paramName = endsWithParam ? last.replace(/[{}]/g, '') : null;

	switch (method) {
		case 'get':
			if (endsWithParam) return `Get ${singularize(humanize(prev) || singular)} by ${paramName}`;
			if (subResource) return `List ${subResource}`;
			return `List ${resource}`;
		case 'post':
			if (subResource) return `Create ${singularize(subResource)}`;
			return `Create ${singular}`;
		case 'put':
		case 'patch':
			if (subResource) return `Update ${singularize(subResource)}`;
			return `Update ${singularize(humanize(prev) || singular)}`;
		case 'delete':
			if (subResource) return `Delete ${singularize(subResource)}`;
			return `Delete ${singularize(humanize(prev) || singular)}`;
		default:
			return `${(method as string).toUpperCase()} ${fullPath}`;
	}
}

/**
 * Root-level tag groups in display order. `key` is the route segment used to
 * bucket operations; `name` is the single source of truth for the tag string
 * written to BOTH `spec.tags` and every operation's `tags`, so Swagger UI can
 * never render a duplicate/empty group from a name mismatch.
 */
const TAG_META: Array<{ key: string; name: string; description: string }> = [
	{ key: 'meta', name: 'Meta', description: 'Service metadata, health and liveness probes.' },
	{ key: 'users', name: 'Users', description: 'Authentication, user accounts, profiles and managers.' },
	{ key: 'roles', name: 'Roles', description: 'Role definitions and role-based access assignments.' },
	{ key: 'organizations', name: 'Organizations', description: 'Organization (tenant) management and admin auth.' },
	{ key: 'departments', name: 'Departments', description: 'Departments within an organization.' },
	{ key: 'projects', name: 'Projects', description: 'Projects and project membership.' },
	{ key: 'tasks', name: 'Tasks', description: 'Tasks, comments, attachments and progress.' },
	{ key: 'goals', name: 'Goals', description: 'Employee and team goals / OKRs.' },
	{ key: 'courses', name: 'Learning', description: 'Learning courses and enrollments.' },
	{ key: 'attendance', name: 'Attendance', description: 'Attendance façade, geo check-in/out and geo-fences.' },
	{ key: 'telemetry', name: 'Telemetry', description: 'Agent desk telemetry (activity/idle rollups by UTC day).' },
	{ key: 'agent', name: 'Agent', description: 'Desktop agent pairing, device tokens and telemetry ingest.' },
	{ key: 'dashboard', name: 'Dashboard', description: 'Aggregated dashboard KPIs.' },
	{ key: 'analytics', name: 'Analytics', description: 'Interpretation layer: telemetry facts + AI reports/rankings.' },
	{ key: 'ai', name: 'AI', description: 'AI microservice integration (sync, reports, queue, DLQ).' },
	{ key: 'performance', name: 'Performance', description: 'Performance reviews and finalization.' },
	{ key: 'compliance', name: 'Compliance', description: 'Compliance rules, violations and acknowledgements.' },
	{ key: 'payroll', name: 'Payroll', description: 'Payroll generation and payslip records.' },
	{ key: 'wellness', name: 'Wellness', description: 'Employee wellness mood logs and signals.' },
	{ key: 'notifications', name: 'Notifications', description: 'In-app notifications and device push tokens.' },
];

const TAG_NAME_BY_KEY = new Map(TAG_META.map((t) => [t.key, t.name]));

/** Display tag for a route bucket key; unknown keys fall back to Title Case. */
function displayTag(key: string): string {
	return TAG_NAME_BY_KEY.get(key) || key.charAt(0).toUpperCase() + key.slice(1);
}

function extractRouterMounts(appTs: string) {
	const re = /app\.use\(\s*['"`]([^'"`]+)['"`]\s*,\s*([A-Za-z0-9_]+)\s*\)/g;
	const mounts: Array<{ basePath: string; varName: string }> = [];
	let m: RegExpExecArray | null;
	while ((m = re.exec(appTs))) {
		mounts.push({ basePath: m[1], varName: m[2] });
	}
	return mounts;
}

function extractImportMap(appTs: string) {
	const re = /import\s+([A-Za-z0-9_]+)\s+from\s+['"`]([^'"`]+)['"`]\s*;/g;
	const map = new Map<string, string>();
	let m: RegExpExecArray | null;
	while ((m = re.exec(appTs))) {
		map.set(m[1], m[2]);
	}
	return map;
}

type RouteDefinition = {
	method: HttpMethod;
	rawPath: string;
	controllerName?: string;
	validateSchemaName?: string;
	/** Original args text between the parens, used for per-route inspection. */
	argList: string;
};

function extractRoutesFromRouterFile(contents: string): RouteDefinition[] {
	// router.<method>('/path', ...) — find the `(` then walk forward respecting
	// nested parens so we don't accidentally consume the next route. This is far
	// more robust than a single greedy regex.
	const startRe = /router\.(get|post|put|patch|delete)\(/g;
	const routes: RouteDefinition[] = [];
	let m: RegExpExecArray | null;
	while ((m = startRe.exec(contents))) {
		const method = m[1] as HttpMethod;
		const openParenIdx = m.index + m[0].length - 1;

		let depth = 1;
		let i = openParenIdx + 1;
		let inStr: string | null = null;
		let inLineComment = false;
		let inBlockComment = false;
		while (i < contents.length && depth > 0) {
			const ch = contents[i];
			const next = contents[i + 1];
			if (inLineComment) {
				if (ch === '\n') inLineComment = false;
			} else if (inBlockComment) {
				if (ch === '*' && next === '/') {
					inBlockComment = false;
					i++;
				}
			} else if (inStr) {
				if (ch === '\\') i++;
				else if (ch === inStr) inStr = null;
			} else if (ch === '/' && next === '/') {
				inLineComment = true;
				i++;
			} else if (ch === '/' && next === '*') {
				inBlockComment = true;
				i++;
			} else if (ch === '"' || ch === "'" || ch === '`') {
				inStr = ch;
			} else if (ch === '(') {
				depth++;
			} else if (ch === ')') {
				depth--;
			}
			i++;
		}
		const argsText = contents.slice(openParenIdx + 1, i - 1);
		// First arg should be the path string literal.
		const pathMatch = /^\s*['"`]([^'"`]+)['"`]\s*,?/.exec(argsText);
		if (!pathMatch) continue;
		const rawPath = pathMatch[1];
		const rest = argsText.slice(pathMatch[0].length);

		const validateMatch = /\bvalidate\(\s*([A-Za-z0-9_]+)\s*\)/.exec(rest);
		const validateSchemaName = validateMatch?.[1];

		// Controller name: last bare identifier that isn't `validate(...)` arg or a known middleware fn call.
		// Heuristic: take the trailing comma-separated arg, strip trailing whitespace.
		const finalArg = rest.trimEnd().replace(/,\s*$/, '').split(',').pop() ?? '';
		const ctrlMatch = /([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(finalArg.trim());
		const controllerName = ctrlMatch?.[1];

		routes.push({ method, rawPath, controllerName, validateSchemaName, argList: rest });
	}
	return routes;
}

function inferPathParams(p: string) {
	const params = [...p.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]);
	return params.map((name) => ({
		name,
		in: 'path' as const,
		required: true,
		schema: { type: 'string' } as JsonSchema,
	}));
}

/** Isolate `export async function name(...) { ... }` for heuristic schema detection. */
function sliceExportAsyncFunction(source: string, exportName: string): string | null {
	const re = new RegExp(`export\\s+async\\s+function\\s+${exportName}\\b`);
	const match = re.exec(source);
	if (!match) return null;
	const braceStart = source.indexOf('{', match.index);
	if (braceStart < 0) return null;
	let depth = 0;
	for (let i = braceStart; i < source.length; i++) {
		const c = source[i];
		const next = source[i + 1];
		if (c === '/' && next === '/') {
			while (i < source.length && source[i] !== '\n') i++;
			continue;
		}
		if (c === '/' && next === '*') {
			i += 2;
			while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
			i++;
			continue;
		}
		if (c === '"' || c === "'" || c === '`') {
			const quote = c;
			i++;
			while (i < source.length) {
				if (source[i] === '\\') {
					i += 2;
					continue;
				}
				if (source[i] === quote) break;
				i++;
			}
			continue;
		}
		if (c === '{') depth++;
		else if (c === '}') {
			depth--;
			if (depth === 0) return source.slice(match.index, i + 1);
		}
	}
	return null;
}

function findQuerySchemaForRoute(
	route: RouteDefinition,
	controllerSrc: string | null,
	validationExports: Record<string, unknown> | null
): AnyZodSchema | null {
	if (!controllerSrc || !validationExports || !route.controllerName) return null;

	if (route.controllerName === 'getWeeklyReportsController') {
		return z.object({
			limit: z.coerce.number().int().min(1).max(30).optional(),
		});
	}

	const fn = sliceExportAsyncFunction(controllerSrc, route.controllerName);
	if (!fn) return null;

	const m = fn.match(/([A-Za-z0-9_]+Schema)\.safeParse\(\s*req\.query\s*\)/);
	if (m) {
		const cand = validationExports[m[1]];
		if (cand && isZodSchema(cand)) return cand;
	}

	if (route.method === 'get' && /dlqQuerySchema\.safeParse/.test(fn) && /req\.query/.test(fn)) {
		const cand = validationExports['dlqQuerySchema'];
		if (cand && isZodSchema(cand)) return cand;
	}

	return null;
}

function zodSchemaToQueryParameters(schema: AnyZodSchema): NonNullable<Operation['parameters']> {
	try {
		const converted = z.toJSONSchema(schema, {
			target: 'draft-7',
		}) as Record<string, unknown>;
		delete converted.$schema;
		const props = (converted.properties ?? {}) as Record<string, JsonSchema>;
		const required = new Set(Array.isArray(converted.required) ? converted.required.map(String) : []);
		const out: NonNullable<Operation['parameters']> = [];
		for (const [name, propSchemaRaw] of Object.entries(props)) {
			const propSchema = { ...(propSchemaRaw as JsonSchema) };
			const desc = (propSchema as { description?: string }).description;
			delete (propSchema as { description?: unknown }).description;
			const hasDefault = Object.prototype.hasOwnProperty.call(propSchema, 'default');
			out.push({
				name,
				in: 'query',
				required: hasDefault ? false : required.has(name),
				...(typeof desc === 'string' ? { description: desc } : {}),
				schema: propSchema,
			});
		}
		return out;
	} catch {
		return [];
	}
}

function mergePathAndQueryParams(
	pathParams: NonNullable<Operation['parameters']>,
	queryParams: NonNullable<Operation['parameters']>
): NonNullable<Operation['parameters']> {
	const seen = new Set(pathParams.map((p) => p.name));
	const filtered = queryParams.filter((q) => !seen.has(q.name));
	return [...pathParams, ...filtered];
}

function tagFromBasePath(basePath: string) {
	const parts = basePath.split('/').filter(Boolean);
	return parts[parts.length - 1] || 'api';
}

const SUCCESS_REF = '#/components/schemas/SuccessEnvelope';
const ERROR_REF = '#/components/schemas/ErrorEnvelope';

function pascalCase(input: string): string {
	return input
		.replace(/Schema$/, '')
		.replace(/[^A-Za-z0-9]+/g, ' ')
		.trim()
		.split(/\s+/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join('');
}

function refResponse(description: string, ref: string): ResponseObject {
	return { description, content: { 'application/json': { schema: { $ref: ref } } } };
}

/** Standard envelope-based responses so Swagger renders response shapes, not just status text. */
function standardResponses(): Operation['responses'] {
	return {
		'200': refResponse('Success', SUCCESS_REF),
		'400': refResponse('Bad Request', ERROR_REF),
		'401': refResponse('Unauthorized', ERROR_REF),
		'403': refResponse('Forbidden', ERROR_REF),
		'500': refResponse('Server Error', ERROR_REF),
	};
}

/**
 * Register a JSON schema as a named component (so it appears under Models) and
 * return a `$ref` to it. Dedupes identical shapes; suffixes on name collisions.
 */
function registerNamedSchema(spec: OpenApiSpec, baseName: string, jsonSchema: JsonSchema): JsonSchema {
	const serialized = JSON.stringify(jsonSchema);
	const existing = spec.components.schemas[baseName];
	if (!existing) {
		spec.components.schemas[baseName] = jsonSchema;
		return { $ref: `#/components/schemas/${baseName}` };
	}
	if (JSON.stringify(existing) === serialized) {
		return { $ref: `#/components/schemas/${baseName}` };
	}
	let i = 2;
	while (
		spec.components.schemas[`${baseName}${i}`] &&
		JSON.stringify(spec.components.schemas[`${baseName}${i}`]) !== serialized
	) {
		i++;
	}
	const name = `${baseName}${i}`;
	spec.components.schemas[name] = jsonSchema;
	return { $ref: `#/components/schemas/${name}` };
}

/** Convert a Zod schema to an OpenAPI-3.0-friendly JSON schema, or null on failure. */
function zodToOpenApiJson(schema: AnyZodSchema): JsonSchema | null {
	try {
		const converted = z.toJSONSchema(schema, { target: 'draft-7' }) as JsonSchema;
		delete (converted as { $schema?: unknown }).$schema;
		return converted;
	} catch {
		return null;
	}
}

/** Human-readable summaries for key routes (path as produced by normalizePath). */
function operationSummary(method: HttpMethod, fullPath: string): string {
	const m = method.toUpperCase();
	const compact = fullPath.replace(/\/+$/, '') || '/';
	const key = `${m} ${compact}`;
	const map: Record<string, string> = {
		'GET /health': 'Liveness probe (no database).',
		'GET /': 'API root — links to Swagger UI and health.',

		// Action-style (non-CRUD) routes: the generic "Create <noun>" fallback
		// reads badly for these, so name the action explicitly.
		'POST /api/v1/users/sign-in': 'Sign in a portal user and issue a JWT pair.',
		'POST /api/v1/users/logout': 'Sign out a portal user and revoke the refresh token.',
		'POST /api/v1/users/refresh-token': 'Rotate portal user access/refresh tokens.',
		'POST /api/v1/users/change-password': "Change the authenticated user's password.",
		'GET /api/v1/users/profile': "Get the authenticated user's profile.",
		'PATCH /api/v1/users/profile': "Update the authenticated user's profile.",
		'GET /api/v1/users/managers': 'List users who can be assigned as managers.',

		'POST /api/v1/organizations/login': 'Sign in an organization admin.',
		'POST /api/v1/organizations/logout': 'Sign out an organization admin.',
		'POST /api/v1/organizations/refresh-token': 'Rotate organization admin tokens.',
		'POST /api/v1/organizations/forgot-password': 'Send an organization admin password reset email.',
		'POST /api/v1/organizations/reset-password': 'Reset an organization admin password using a reset token.',
		'POST /api/v1/organizations/change-admin-password': 'Change the organization admin password.',
		'POST /api/v1/organizations/register': 'Register a user into the organization.',

		'PUT /api/v1/departments/reassign-users': 'Reassign users from one department to another.',

		'POST /api/v1/projects/{id}/members': 'Add a member to a project.',
		'DELETE /api/v1/projects/{id}/members/{userId}': 'Remove a member from a project.',

		'PATCH /api/v1/goals/{id}/progress': 'Update progress on a goal.',

		'POST /api/v1/courses/{id}/enroll': 'Enroll the authenticated user in a course.',
		'GET /api/v1/courses/enrollments': 'List course enrollments for the caller.',

		'PATCH /api/v1/notifications/read-all': 'Mark all notifications as read.',
		'PATCH /api/v1/notifications/{id}/read': 'Mark a single notification as read.',

		'POST /api/v1/wellness/mood': 'Log a wellness mood entry.',
		'GET /api/v1/wellness': 'List wellness logs for the organization.',
		'GET /api/v1/wellness/me': "List the authenticated employee's wellness logs.",

		'POST /api/v1/payroll/generate': 'Generate payroll for a pay period.',
		'GET /api/v1/payroll': 'List payroll records for the organization.',
		'GET /api/v1/payroll/{id}': 'Get a payroll record by id.',
		'GET /api/v1/payroll/user/{userId}': 'List payroll records for one user.',

		'POST /api/v1/agent/revoke': 'Revoke agent device tokens.',
		'GET /api/v1/telemetry/agent/daily':
			'Agent desk telemetry by UTC day (activity_logs + idle_logs rollups); org-scoped via JWT.',
		'GET /api/v1/telemetry/agent/apps-by-day':
			'Aggregated application usage seconds for the organization on one UTC calendar day.',
		'GET /api/v1/telemetry/agent/desk-latest':
			'Latest activity row per user (current app) for a UTC day; optional userId filter.',
		'GET /api/v1/telemetry/agent/activity-detail':
			'Paginated activity segments for one user and UTC calendar day (drill-down).',
		'GET /api/v1/attendance':
			'Attendance list façade — same daily aggregates as telemetry in AttendanceLog-compatible shape.',
		'GET /api/v1/attendance/me':
			'Desk telemetry rows for the authenticated employee only (JWT must include userId).',
		'POST /api/v1/attendance/check-in':
			'Employee geo check-in (optional lat/lng validated against org fences).',
		'POST /api/v1/attendance/check-out': 'Employee check-out for the open attendance session.',
		'GET /api/v1/attendance/geo-fences': 'List organization geo-fences.',
		'POST /api/v1/attendance/geo-fences': 'Create a geo-fence (org admin).',
		'DELETE /api/v1/attendance/geo-fences/{id}': 'Delete a geo-fence (org admin).',
		'POST /api/v1/agent/pairing-code':
			'Issue a one-time device pairing code for the authenticated employee.',
		'POST /api/v1/agent/register':
			'Register a workstation with pairingCode only; returns device JWT pair.',
		'POST /api/v1/agent/refresh-token': 'Rotate agent device access/refresh tokens.',
		'POST /api/v1/agent/heartbeat': 'Device online heartbeat (Bearer device JWT).',
		'POST /api/v1/agent/activity': 'Batch window/activity telemetry (Bearer device JWT).',
		'POST /api/v1/agent/idle': 'Idle sample (Bearer device JWT).',
		'POST /api/v1/notifications/push-token': 'Register FCM/APNs device push token.',
		'DELETE /api/v1/notifications/push-token': 'Unregister device push token.',
		'POST /api/v1/compliance/rules': 'Create a compliance rule (org admin).',
		'GET /api/v1/compliance/rules': 'List compliance rules (org admin).',
		'PATCH /api/v1/compliance/rules/{id}': 'Update a compliance rule (org admin).',
		'DELETE /api/v1/compliance/rules/{id}': 'Delete a compliance rule (org admin).',
		'POST /api/v1/compliance/rules/{id}/acknowledge': 'Employee acknowledges a compliance rule.',
		'GET /api/v1/compliance/violations': 'List compliance violations for the caller org.',
		'PATCH /api/v1/compliance/violations/{id}/resolve': 'Resolve a violation (manager/admin).',
		'POST /api/v1/performance/generate': 'Generate weighted performance review (manager/admin).',
		'GET /api/v1/performance': 'List performance reviews for the organization.',
		'GET /api/v1/performance/{id}': 'Get a performance review by id.',
		'PATCH /api/v1/performance/{id}/finalize': 'Finalize review with signatures (manager/admin).',
		'POST /api/v1/ai/employee-data':
			'Sync employee + telemetry scalars to the AI analytics microservice.',
		'POST /api/v1/ai/task-data': 'Sync task progress payload to the AI analytics microservice.',
		'POST /api/v1/ai/report': 'Generate analytics report synchronously via AI server.',
		'POST /api/v1/ai/report/enqueue': 'Queue analytics report generation (RabbitMQ consumer).',
		'POST /api/v1/ai/report/replay': 'Re-queue analytics report generation with supplied payload.',
		'GET /api/v1/ai/report/dlq': 'Peek failed AI jobs (DLQ) for troubleshooting.',
		'POST /api/v1/ai/report/dlq/replay': 'Replay DLQ payloads back to the AI queue.',
		'GET /api/v1/ai/reports/{employeeId}':
			'Fetch recent weekly AI reports for an employee; tenant/org comes from JWT, not query.',
		'GET /api/v1/projects/{id}/members':
			'List project members with user id and display name (JWT org must match project).',
		'GET /api/v1/dashboard/summary':
			'Dashboard KPIs: agent telemetry rollups (UTC days), members, tasks/projects, optional viewer slice + unread notifications.',
		'GET /api/v1/analytics/overview':
			'Interpretation layer: telemetry facts + optional AI weekly reports per employee (distinct from raw desk metrics).',
		'GET /api/v1/analytics/productivity':
			'Task-based productivity rows for a date window (Postgres facts — not AI scores).',
		'GET /api/v1/analytics/team-performance':
			'Team rows blending tasks (window) + goals snapshot (Postgres facts — not AI scores).',
		'GET /api/v1/analytics/ai-performance-ranking':
			'AI microservice ranking: weighted pillars + optional Random Forest blend from Postgres-derived metrics (JWT org).',
		'POST /api/v1/analytics/ai-report/generate':
			'Portal helper: build AI report input from org data and call AI server.',
		'GET /api/v1/analytics/ai-reports/{employeeId}':
			'Portal helper: weekly AI reports for an employee (JWT org).',
	};
	return map[key] || map[`${m} ${compact}/`] || map[`${m} ${compact.replace(/\/$/, '')}`] || '';
}

function needsAuth(routerContents: string, route: RouteDefinition) {
	// Whole-file: router.use(authenticateJWT, ...) covers everything in this
	// router (also matches multi-arg forms like router.use(authenticateJWT, requirePortalToken)).
	if (/router\.use\(\s*authenticateJWT\b/.test(routerContents)) return true;
	// Per-route: authenticateJWT appears in *this* route's args.
	return /\bauthenticateJWT\b/.test(route.argList);
}

function tryRequireValidation(modulePath: string): Record<string, unknown> | null {
	try {
		// Use require so ts-node can transpile the .ts file synchronously.
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		return require(modulePath);
	} catch {
		return null;
	}
}

function findSchemaForRoute(
	route: RouteDefinition,
	controllerSrc: string | null,
	validationExports: Record<string, unknown> | null
): { name: string; schema: AnyZodSchema } | null {
	if (!validationExports) return null;

	// 1) Direct hit via validate(SchemaName) middleware in the routes file.
	if (route.validateSchemaName) {
		const candidate = validationExports[route.validateSchemaName];
		if (candidate && isZodSchema(candidate)) {
			return { name: route.validateSchemaName, schema: candidate };
		}
	}

	if (!controllerSrc || !route.controllerName) return null;

	// 2) Find the controller function body and look for schema usage.
	const fnRe = new RegExp(
		`(?:export\\s+)?(?:const|function|async\\s+function)\\s+${route.controllerName}\\b[\\s\\S]*?\\{([\\s\\S]*?)\\n\\};?`,
		'm'
	);
	const match = fnRe.exec(controllerSrc);
	const body = match?.[1] ?? controllerSrc; // fallback: search whole file

	// Pattern A: someSchema.safeParse(req.body) — also matches the common
	// spread form someSchema.safeParse({ ...req.body, tenantId }).
	const aRe = /([A-Za-z0-9_]+Schema)\.safeParse\(\s*(?:\{\s*\.\.\.\s*)?req\.body/;
	const a = aRe.exec(body);
	if (a) {
		const candidate = validationExports[a[1]];
		if (candidate && isZodSchema(candidate)) {
			return { name: a[1], schema: candidate };
		}
	}

	// Pattern B: validateXxx(req.body)
	const bRe = /\b(validate[A-Z][A-Za-z0-9_]*)\(\s*req\.body\s*\)/;
	const b = bRe.exec(body);
	if (b) {
		// validateXxx exports a function that wraps a schema. Try to find the
		// matching schema export by stripping the "validate" prefix and
		// converting to lowerCamelCase + "Schema".
		const baseName = b[1].replace(/^validate/, '');
		const lower = baseName.charAt(0).toLowerCase() + baseName.slice(1);
		const guesses = [
			`${lower}Schema`,
			`${baseName.charAt(0).toLowerCase()}${baseName.slice(1)}Schema`,
		];
		for (const g of guesses) {
			const candidate = validationExports[g];
			if (candidate && isZodSchema(candidate)) {
				return { name: g, schema: candidate };
			}
		}
	}

	return null;
}

function isZodSchema(value: unknown): value is AnyZodSchema {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { safeParse?: unknown }).safeParse === 'function'
	);
}

function main() {
	const repoRoot = path.resolve(__dirname, '..');
	const appPath = path.join(repoRoot, 'src', 'app.ts');
	const appTs = fs.readFileSync(appPath, 'utf8');

	const mounts = extractRouterMounts(appTs);
	const imports = extractImportMap(appTs);

	const spec: OpenApiSpec = {
		openapi: '3.0.3',
		info: {
			title: 'Remote Work Tracker — Portal API',
			version: '1.0.0',
			contact: { name: 'Remote Work Tracker', url: 'https://remote-work-tracker.vercel.app' },
			description:
				'REST API for the Remote Work Tracker web portal (Express + TypeScript). ' +
				'Routes and Zod request/response schemas are generated from source via `npm run openapi:generate`.\n\n' +
				'### Authentication\n' +
				'Most endpoints require a **portal JWT** as a Bearer token. Click **Authorize** and paste your access token, then use **Try it out** on any operation. ' +
				'Agent (device) endpoints under `/api/v1/agent/*` use a separate **device JWT**.\n\n' +
				'### Response envelope\n' +
				'Successful responses use the `SuccessEnvelope` shape (`{ success, message, data }`); failures use `ErrorEnvelope` (`{ success, message, code?, errors? }`).\n\n' +
				'### Attendance / agent desk\n' +
				'Canonical read model is **`GET /api/v1/telemetry/agent/daily`** and **`GET /api/v1/telemetry/agent/activity-detail`** (UTC calendar days). **`GET /api/v1/attendance`** is a façade of the same aggregates for legacy clients.\n\n' +
				'### AI analytics\n' +
				'Paths under **`/api/v1/ai/*`** authenticate with the portal JWT, then the backend calls the **AI microservice** using service credentials. Pair this spec with the FastAPI OpenAPI at **`{AI_SERVER_URL}/docs`**.',
		},
		servers: [
			{ url: 'https://remote-work-tracker.vercel.app', description: 'Production (Vercel)' },
			{ url: 'http://localhost:5000', description: 'Local development' },
			{ url: '/', description: 'Relative to current host' },
		],
		tags: [],
		components: {
			securitySchemes: {
				bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
			},
			schemas: {
				SuccessEnvelope: {
					type: 'object',
					description: 'Standard success response envelope returned by portal endpoints.',
					properties: {
						success: { type: 'boolean', example: true },
						message: { type: 'string', example: 'Success' },
						data: {
							description: 'Endpoint-specific payload (object, array, or null).',
							nullable: true,
						},
					},
					required: ['success', 'message'],
				},
				ErrorEnvelope: {
					type: 'object',
					description: 'Standard error response envelope.',
					properties: {
						success: { type: 'boolean', example: false },
						message: { type: 'string', example: 'Something went wrong' },
						code: { type: 'string', example: 'BAD_REQUEST' },
						errors: {
							description: 'Optional validation issues or error detail.',
							nullable: true,
						},
					},
					required: ['success', 'message'],
				},
			},
		},
		security: [{ bearerAuth: [] }],
		paths: {},
	};

	const usedTags = new Set<string>();

	// Non-router endpoints defined directly on the Express app.
	spec.paths['/health'] = {
		get: {
			tags: [displayTag('meta')],
			summary: operationSummary('get', '/health') || 'Liveness probe',
			operationId: makeOperationId('get', '/health'),
			security: [],
			parameters: [],
			responses: {
				'200': refResponse('Service is alive', SUCCESS_REF),
			},
		},
	};
	spec.paths['/'] = {
		get: {
			tags: [displayTag('meta')],
			summary: operationSummary('get', '/') || 'API root',
			operationId: makeOperationId('get', '/'),
			security: [],
			parameters: [],
			responses: {
				'200': { description: 'API root metadata / HTML index' },
			},
		},
	};
	usedTags.add('meta');
	let totalOps = 2;
	let opsWithBodySchema = 0;

	for (const { basePath, varName } of mounts) {
		const importPath = imports.get(varName);
		if (!importPath) continue;

		const routerAbs = path.resolve(path.dirname(appPath), importPath) + '.ts';
		if (!fs.existsSync(routerAbs)) continue;

		const routerContents = fs.readFileSync(routerAbs, 'utf8');
		const routes = extractRoutesFromRouterFile(routerContents);
		const tagKey = tagFromBasePath(basePath);
		const tag = displayTag(tagKey);
		usedTags.add(tagKey);

		// All controllers + validation modules in the folder (covers *.checkin.controller.ts etc.)
		const moduleDir = path.dirname(routerAbs);
		const controllerFiles = fs
			.readdirSync(moduleDir)
			.filter((f) => f.endsWith('.controller.ts'))
			.map((f) => path.join(moduleDir, f));
		const controllerSrc = controllerFiles
			.map((p) => fs.readFileSync(p, 'utf8'))
			.join('\n\n');
		const validationExports: Record<string, unknown> = {};
		for (const f of fs.readdirSync(moduleDir).filter((name) => name.endsWith('.validation.ts'))) {
			const exported = tryRequireValidation(path.join(moduleDir, f));
			if (exported) Object.assign(validationExports, exported);
		}
		// Inline Zod schemas living in controller files are not require()-able; skip.

		for (const r of routes) {
			const fullPath = normalizePath(basePath, r.rawPath);
			spec.paths[fullPath] ||= {};

			const pathParams = inferPathParams(fullPath);
			const querySchema = findQuerySchemaForRoute(
				r,
				controllerSrc || null,
				Object.keys(validationExports).length ? validationExports : null
			);
			const queryParams =
				querySchema && r.method === 'get' ? zodSchemaToQueryParameters(querySchema) : [];

			const operation: Operation = {
				tags: [tag],
				summary: operationSummary(r.method, fullPath) || defaultSummary(r.method, fullPath, tagKey),
				operationId: makeOperationId(r.method, fullPath),
				security: needsAuth(routerContents, r) ? [{ bearerAuth: [] }] : [],
				parameters: mergePathAndQueryParams(pathParams, queryParams),
				responses: standardResponses(),
			};

			if (r.method === 'post' || r.method === 'put' || r.method === 'patch') {
				const matched = findSchemaForRoute(
					r,
					controllerSrc || null,
					Object.keys(validationExports).length ? validationExports : null
				);
				let bodySchema: JsonSchema = { type: 'object' };
				if (matched) {
					const converted = zodToOpenApiJson(matched.schema);
					if (converted) {
						// Register as a named component so it appears under Models and
						// request bodies render their fields via $ref.
						const schemaName = `${pascalCase(tag)}${pascalCase(matched.name)}`;
						bodySchema = registerNamedSchema(spec, schemaName, converted);
						opsWithBodySchema += 1;
					} else {
						console.warn(
							`Failed to convert ${matched.name} for ${r.method.toUpperCase()} ${fullPath}`
						);
					}
				} else if (r.controllerName && /checkIn|checkOut|geoFence|GeoFence/i.test(r.controllerName + r.argList)) {
					// Inline Zod in attendance.checkin.controller.ts — document manually.
					const inline = inferInlineCheckinBody(r.controllerName);
					if (inline.properties) {
						const inlineName = `${pascalCase(tag)}${pascalCase(r.controllerName)}Body`;
						bodySchema = registerNamedSchema(spec, inlineName, inline);
						opsWithBodySchema += 1;
					}
				}
				operation.requestBody = {
					required: true,
					content: {
						'application/json': { schema: bodySchema },
					},
				};
			}

			spec.paths[fullPath][r.method] = operation;
			totalOps += 1;
		}
	}

	// Root-level tag groups: ordered, described, only those actually used.
	const knownKeys = new Set(TAG_META.map((t) => t.key));
	spec.tags = [
		...TAG_META.filter((t) => usedTags.has(t.key)).map((t) => ({
			name: t.name,
			description: t.description,
		})),
		...[...usedTags]
			.filter((k) => !knownKeys.has(k))
			.sort()
			.map((k) => ({ name: displayTag(k) })),
	];

	// Guard: every operation tag must be declared at root, or Swagger UI renders
	// a second, empty group for it.
	const declared = new Set(spec.tags.map((t) => t.name));
	const undeclared = new Set<string>();
	for (const p of Object.keys(spec.paths)) {
		for (const op of Object.values(spec.paths[p])) {
			for (const t of op?.tags ?? []) if (!declared.has(t)) undeclared.add(t);
		}
	}
	if (undeclared.size) {
		throw new Error(
			`Operation tags missing from spec.tags: ${[...undeclared].join(', ')}. Add them to TAG_META.`
		);
	}

	const outDir = path.join(repoRoot, 'public', 'swagger');
	fs.mkdirSync(outDir, { recursive: true });
	fs.writeFileSync(
		path.join(outDir, 'openapi.json'),
		JSON.stringify(spec, null, 2),
		'utf8'
	);
	console.log(
		`Generated OpenAPI spec at public/swagger/openapi.json: ${
			Object.keys(spec.paths).length
		} paths, ${totalOps} operations, ${opsWithBodySchema} with inferred Zod body schemas, ${
			Object.keys(spec.components.schemas).length
		} component schemas (Models).`
	);
}

function inferInlineCheckinBody(controllerName: string): JsonSchema {
	if (/checkIn/i.test(controllerName)) {
		return {
			type: 'object',
			properties: {
				latitude: { type: 'number', minimum: -90, maximum: 90 },
				longitude: { type: 'number', minimum: -180, maximum: 180 },
				ipAddress: { type: 'string', minLength: 3, maxLength: 64 },
				deviceId: { type: 'string' },
			},
			required: ['latitude', 'longitude', 'ipAddress'],
			additionalProperties: false,
		};
	}
	if (/checkOut/i.test(controllerName)) {
		return {
			type: 'object',
			properties: {
				sessionId: { type: 'string', format: 'uuid' },
				deviceId: { type: 'string' },
			},
			required: ['sessionId'],
			additionalProperties: false,
		};
	}
	if (/createGeoFence|GeoFence/i.test(controllerName)) {
		return {
			type: 'object',
			properties: {
				name: { type: 'string', minLength: 1, maxLength: 100 },
				latitude: { type: 'number', minimum: -90, maximum: 90 },
				longitude: { type: 'number', minimum: -180, maximum: 180 },
				radiusMeters: { type: 'number', exclusiveMinimum: 0 },
			},
			required: ['name', 'latitude', 'longitude', 'radiusMeters'],
			additionalProperties: false,
		};
	}
	return { type: 'object' };
}

main();
