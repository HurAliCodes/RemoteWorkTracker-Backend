# Role & token matrix (P0)

## Token types (`typ` claim)

| `typ` | Issued by | Can call |
| --- | --- | --- |
| `user` | Employee sign-in / org user register | Portal APIs (`requirePortalToken`) |
| `org_admin` | Organization login / refresh | Portal APIs + admin-gated routes (`requireOrgAdmin`) |
| `device` | Agent device register / refresh | Agent telemetry only (`requireDeviceToken`) |

Legacy tokens without `typ` are inferred: `deviceId` → device, `admin: true` → org_admin, `userId` → user.

Device JWTs are rejected on all portal routers. Portal JWTs are rejected on agent heartbeat/activity/idle.

## Role gates (employee JWT)

Role names are normalized (`Admin` / `SUPER_ADMIN` → `admin` / `super_admin`). Matching is **exact set membership** (not substring).

| Middleware | Allowed |
| --- | --- |
| `requireOrgAdmin` | `org_admin` token **or** role `admin` / `super_admin` |
| `requireManagerOrAdmin` | `org_admin` token **or** role `manager` / `admin` / `super_admin` |
| `requireEmployeeToken` | Employee `user` token with `userId` (pairing-code) |

## Tenant isolation

- List endpoints resolve caller `organizationId` from the JWT (DB fallback for employees).
- `:id` reads/writes for tasks, projects, goals, departments, payroll, attendance, and courses assert the resource belongs to the caller org (404 on cross-tenant).
- Department create always uses the caller org (body `organizationId` is ignored).
- Org user list/update/delete/register require `requireOrgAdmin`.

## Rate limits

- Auth: login, register, forgot/reset password, refresh.
- Agent: register + refresh.
- AI-heavy portal/AI report routes.
- When `REDIS_URL` is set, limits use Redis; otherwise in-process memory.
