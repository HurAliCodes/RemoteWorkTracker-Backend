import fs from 'fs';
import path from 'path';
import { z } from 'zod';

// Zod v4 ships with a built-in JSON Schema converter (`z.toJSONSchema`).
// We use the loose ZodType type since exported schemas in this project are
// plain `z.object(...)` etc., which all extend ZodType.
type AnyZodSchema = z.ZodType<unknown>;

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

type JsonSchema = Record<string, unknown>;

type Operation = {
	tags: string[];
	summary: string;
	security?: { bearerAuth: [] }[];
	parameters?: Array<{
		name: string;
		in: 'path' | 'query' | 'header' | 'cookie';
		required?: boolean;
		schema: JsonSchema;
	}>;
	requestBody?: {
		required?: boolean;
		content: { 'application/json': { schema: JsonSchema } };
	};
	responses: Record<string, { description: string }>;
};

type OpenApiSpec = {
	openapi: '3.0.3';
	info: { title: string; version: string; description?: string };
	servers: { url: string }[];
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
	const withSlash = full.startsWith('/') ? full : `/${full}`;
	// Convert Express ":id" to OpenAPI "{id}".
	return withSlash.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
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

/** Human-readable summaries for key routes (path as produced by normalizePath). */
function operationSummary(method: HttpMethod, fullPath: string): string {
	const m = method.toUpperCase();
	const compact = fullPath.replace(/\/+$/, '') || '/';
	const key = `${m} ${compact}`;
	const map: Record<string, string> = {
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
	};
	return map[key] || map[`${m} ${compact}/`] || `${m} ${fullPath}`;
}

function needsAuth(routerContents: string, route: RouteDefinition) {
	// Whole-file: router.use(authenticateJWT) covers everything in this router.
	if (/router\.use\(\s*authenticateJWT\s*\)/.test(routerContents)) return true;
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

	// Pattern A: someSchema.safeParse(req.body)
	const aRe = /([A-Za-z0-9_]+Schema)\.safeParse\(\s*req\.body\s*\)/;
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
			title: 'Portal backend API',
			version: '1.0.0',
			description:
				'Express API for the Remote Work Tracker web portal. Route tables and Zod body/query schemas are scraped from source; see `scripts/generate-openapi.ts`.\n\n' +
				'**Attendance / agent desk:** Canonical read model is **`GET /api/v1/telemetry/agent/daily`** and **`GET /api/v1/telemetry/agent/activity-detail`** (UTC calendar days). **`GET /api/v1/attendance`** list is a façade of the same aggregates for legacy clients.\n\n' +
				'**AI analytics:** Paths under **`/api/v1/ai/*`** authenticate with the **portal JWT**, then the backend calls the **AI microservice** using service credentials. Pair this spec with the FastAPI OpenAPI at **`{AI_SERVER_URL}/docs`** (`ai-server`).',
		},
		servers: [{ url: '/' }],
		components: {
			securitySchemes: {
				bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
			},
			schemas: {},
		},
		security: [{ bearerAuth: [] }],
		paths: {},
	};

	let totalOps = 0;
	let opsWithBodySchema = 0;

	for (const { basePath, varName } of mounts) {
		const importPath = imports.get(varName);
		if (!importPath) continue;

		const routerAbs = path.resolve(path.dirname(appPath), importPath) + '.ts';
		if (!fs.existsSync(routerAbs)) continue;

		const routerContents = fs.readFileSync(routerAbs, 'utf8');
		const routes = extractRoutesFromRouterFile(routerContents);
		const tag = tagFromBasePath(basePath);

		// Sibling controller + validation files (pattern: <module>.controller.ts, <module>.validation.ts)
		const moduleDir = path.dirname(routerAbs);
		const moduleBase = path.basename(routerAbs, '.routes.ts');
		const controllerAbs = path.join(moduleDir, `${moduleBase}.controller.ts`);
		const validationAbs = path.join(moduleDir, `${moduleBase}.validation.ts`);
		const controllerSrc = fs.existsSync(controllerAbs)
			? fs.readFileSync(controllerAbs, 'utf8')
			: null;
		const validationExports = fs.existsSync(validationAbs)
			? tryRequireValidation(validationAbs)
			: null;

		for (const r of routes) {
			const fullPath = normalizePath(basePath, r.rawPath);
			spec.paths[fullPath] ||= {};

			const pathParams = inferPathParams(fullPath);
			const querySchema = findQuerySchemaForRoute(r, controllerSrc, validationExports);
			const queryParams =
				querySchema && r.method === 'get' ? zodSchemaToQueryParameters(querySchema) : [];

			const operation: Operation = {
				tags: [tag],
				summary: operationSummary(r.method, fullPath),
				security: needsAuth(routerContents, r) ? [{ bearerAuth: [] }] : [],
				parameters: mergePathAndQueryParams(pathParams, queryParams),
				responses: {
					'200': { description: 'Success' },
					'400': { description: 'Bad Request' },
					'401': { description: 'Unauthorized' },
					'403': { description: 'Forbidden' },
					'500': { description: 'Server Error' },
				},
			};

			if (r.method === 'post' || r.method === 'put' || r.method === 'patch') {
				const matched = findSchemaForRoute(r, controllerSrc, validationExports);
				let bodySchema: JsonSchema = { type: 'object' };
				if (matched) {
					try {
						const converted = z.toJSONSchema(matched.schema, {
							target: 'draft-7',
						}) as JsonSchema;
						// Drop fields that aren't valid in OpenAPI 3.0.
						delete (converted as { $schema?: unknown }).$schema;
						bodySchema = converted;
						opsWithBodySchema += 1;
					} catch (err) {
						console.warn(
							`Failed to convert ${matched.name} for ${r.method.toUpperCase()} ${fullPath}:`,
							err instanceof Error ? err.message : err
						);
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
		} paths, ${totalOps} operations, ${opsWithBodySchema} with inferred Zod body schemas.`
	);
}

main();
