# Frontend API Guide for AI-Generated UI

Last updated: 2026-03-22  
Source of truth: backend code in `src/app.ts`, route files, controllers, validation, and services.

Page-level screen planning companion:
- See `backend/docs/WEB_PAGE_API_PAGE_MAP.md` for detailed per-page sections, mobile/desktop behavior, and endpoint mapping.

## 1. API Base and Global Conventions

- Next.js app (local): `http://localhost:3000`
- Portal **API** (Express, local): `http://localhost:5000`
- API prefix: `/api/v1`
- Full API base for frontend clients (`NEXT_PUBLIC_API_URL`): `http://localhost:5000/api/v1`
- Health check: `GET /`

### Standard success/error wrappers
Most modules return this shape:

```json
{
  "success": true,
  "message": "Human readable message",
  "data": {}
}
```

Error shape for most controllers:

```json
{
  "success": false,
  "message": "Error message",
  "errors": []
}
```

Important inconsistency:
- A few endpoints return custom JSON (not wrapped), especially:
- `GET /roles`
- Some organization/department helper endpoints
- You should normalize responses in frontend service layer.

### Auth header
For protected endpoints:

`Authorization: Bearer <accessToken>`

## 2. Modules Actually Mounted in Express App

Mounted (available now):
- `/roles`
- `/organizations`
- `/departments`
- `/projects`
- `/notifications`
- `/goals`
- `/courses` (learning module)
- `/users`
- `/wellness`

Present in code but NOT mounted/exposed in `src/app.ts` right now:
- analytics
- attendance
- activity

If frontend needs those, backend must mount corresponding routers first.

## 3. Authentication and Session Flows (Frontend)

There are 2 login domains in this backend:
- Organization admin auth via `/organizations/*`
- User auth via `/users/*`

### 3.1 User auth endpoints (`/api/v1/users`)

1) `POST /users/sign-in`
- Auth: Public
- Body:
```json
{
  "email": "user@company.com",
  "password": "string(min 6)"
}
```
- Returns (`data`):
```json
{
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "user": {
    "userId": "uuid",
    "name": "string",
    "email": "string",
    "roleId": "uuid",
    "departmentId": "uuid",
    "organizationId": "uuid"
  }
}
```

2) `POST /users/refresh-token`
- Auth: Public
- Body:
```json
{ "refreshToken": "string(min 10)" }
```
- Returns (`data`):
```json
{ "accessToken": "jwt", "refreshToken": "jwt" }
```

3) `POST /users/logout`
- Auth: Required
- Body:
```json
{ "refreshToken": "string(min 10)" }
```

4) `POST /users/change-password`
- Auth: Required
- Body:
```json
{ "oldPassword": "string(min 6)", "newPassword": "string(min 6)" }
```

5) `GET /users/profile`
- Auth: Required
- Returns (`data`):
```json
{
  "userId": "uuid",
  "name": "string",
  "email": "string",
  "roleId": "uuid",
  "departmentId": "uuid",
  "organizationId": "uuid",
  "region": "2-letter",
  "salary": 0,
  "createdAt": "ISO datetime",
  "updatedAt": "ISO datetime"
}
```

6) `PATCH /users/profile`
- Auth: Required
- Body (at least one):
```json
{
  "name": "string 2..100",
  "region": "2-letter code",
  "email": "valid email"
}
```
- Returns updated profile in `data`

### 3.2 Organization/admin auth endpoints (`/api/v1/organizations`)

1) `POST /organizations/login`
- Auth: Public
- Body:
```json
{
  "email": "valid email",
  "password": "string(min 6)"
}
```
- Returns (`data`):
```json
{
  "organizationId": "uuid",
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "expiresIn": 900,
  "adminEmail": "string",
  "organizationName": "string"
}
```

2) `POST /organizations/refresh-token`
- Auth: Public
- Body: `{ "refreshToken": "string(min 10)" }`
- Returns new access token in `data`

3) `POST /organizations/logout`
- Auth: Public (currently no JWT middleware)
- Body: `{ "refreshToken": "token" }`

4) `POST /organizations/forgot-password`
- Auth: Public
- Body: `{ "email": "valid email" }`

5) `POST /organizations/reset-password`
- Auth: Public
- Body:
```json
{
  "resetCode": "6 digit numeric string",
  "newPassword": "min 8, upper+lower+number+symbol"
}
```

## 4. Organization and User Admin APIs

### 4.1 Organizations (`/api/v1/organizations`)

1) `POST /organizations`
- Create organization + admin
- Body:
```json
{
  "name": "string 2..100",
  "address": "string optional",
  "organization_type": "string optional",
  "adminEmail": "valid email",
  "adminPassword": "string(min 6)"
}
```

2) `POST /organizations/register`
- Register user under org
- Body:
```json
{
  "name": "string(min 3)",
  "email": "valid email",
  "password": "min 8 with strong regex",
  "roleId": "uuid",
  "departmentId": "uuid",
  "organizationId": "uuid",
  "region": "2-letter",
  "salary": 0
}
```
- Returns raw response (not wrapped in `success/data`) in current controller

3) `GET /organizations/users`

**Response (200 OK) - Actual Backend Format:**
```json
{
  "success": true,
  "data": [
    {
      "user_id": "uuid",
      "name": "string",
      "email": "string",
      "role_id": "uuid",
      "department_id": "uuid",
      "organization_id": "uuid",
      "region": "2-letter",
      "salary": "numeric string (e.g., '10000.00')",
      "password_hash": "bcrypt hash",
      "created_at": "ISO 8601 datetime",
      "updated_at": "ISO 8601 datetime"
    }
  ]
}
```

**Frontend Mapping Notes:**
- Response uses snake_case field names (user_id, role_id, department_id, etc.)
- Frontend must handle both snake_case and camelCase for compatibility
- salary is returned as string - parse with `parseFloat()` before display
- Dates in ISO 8601 format - use `new Date()` for parsing
- password_hash should NEVER be displayed to user (read-only in backend)
4) `DELETE /organizations/users/:id`
- Auth: Required
- Deletes user

5) `GET /organizations/:id`
- Auth: Required
- Returns organization details in `data`

6) `POST /organizations/change-admin-password`
- Auth: Required
- Body:
```json
{
  "organizationId": "uuid",
  "oldPassword": "string(min 8)",
  "newPassword": "min 8 with strong regex"
}
```

## 5. Roles APIs (`/api/v1/roles`)

1) `POST /roles`
- Create role
- Body:
```json
{ "name": "string 3..100", "description": "string optional" }
```

2) `GET /roles`
- Returns custom shape:
```json
{ "roles": [ ... ] }
```

3) `GET /roles/:id`
4) `PATCH /roles/:id`
5) `DELETE /roles/:id`

6) `POST /roles/add-permission`
- Auth: Required
- Body:
```json
{
  "role_id": "uuid",
  "permission": "string"
}
```
or
```json
{
  "role_id": "uuid",
  "permissions": ["perm.a", "perm.b"]
}
```

## 6. Departments APIs (`/api/v1/departments`)

1) `POST /departments`
- Supports 3 input modes:
- Single object:
```json
{ "name": "Engineering", "organizationId": "uuid" }
```
- Comma list mode:
```json
{ "names": "Engineering,HR,Design", "organizationId": "uuid" }
```
- Array mode:
```json
[
  { "name": "Engineering", "organizationId": "uuid" },
  { "name": "HR", "organizationId": "uuid" }
]
```

2) `GET /departments?page=1&limit=20`
- Paginated
- Returns:
```json
{
  "meta": { "page": 1, "limit": 20, "totalRecords": 0, "totalPages": 0 },
  "data": [
    { "departmentId": "uuid", "name": "string", "createdAt": "ISO" }
  ]
}
```

3) `GET /departments/:id`
- Returns normalized `departmentId/name/organizationId/...` in `data`

4) `PATCH /departments/:id`
- Body:
```json
{ "name": "optional 2..100", "organizationId": "optional uuid" }
```

5) `DELETE /departments/:id`

6) `PUT /departments/reassign-users`
- Auth: Required
- Body:
```json
{ "fromDepartmentId": "uuid", "toDepartmentId": "uuid" }
```

## 7. Projects APIs (`/api/v1/projects`)

1) `POST /projects`
- Body:
```json
{
  "name": "string 1..100",
  "description": "string optional",
  "manager_id": "uuid",
  "organization_id": "uuid",
  "start_date": "date string",
  "end_date": "date string >= start_date"
}
```

2) `GET /projects?page=1&limit=20&organization_id=<uuid>`
- Paginated with `meta` + `data`
- Uses snake_case fields in project rows (`project_id`, `manager_id`, etc.)

3) `GET /projects/:id`
- Returns project DB row (snake_case)

4) `PATCH /projects/:id`
- Updatable fields:
```json
{
  "name": "optional",
  "description": "optional",
  "manager_id": "optional uuid",
  "start_date": "optional date",
  "end_date": "optional date"
}
```

5) `DELETE /projects/:id`

6) `POST /projects/:id/members`
- Body:
```json
{ "user_id": "uuid", "role": "optional string" }
```

7) `DELETE /projects/:id/members/:userId`

## 8. Goals APIs (`/api/v1/goals`)

1) `POST /goals`
- Body:
```json
{
  "title": "string(min 3)",
  "userId": "uuid",
  "description": "string optional <=500",
  "deadline": "valid future date"
}
```

2) `GET /goals?userId=<uuid>&status=ON_TRACK|AT_RISK&page=1&limit=20`
- Returns paginated list with computed `status` based on progress

3) `GET /goals/:id`

4) `PATCH /goals/:id`
- At least one field required:
```json
{
  "title": "optional",
  "userId": "optional uuid",
  "description": "optional",
  "deadline": "optional future date"
}
```

5) `PATCH /goals/:id/progress`
- Body:
```json
{ "progress": 0 }
```
- Range: 0 to 100

6) `DELETE /goals/:id`

Goal response model (`data` item):
```json
{
  "goalId": "uuid",
  "title": "string",
  "userId": "uuid",
  "description": "string|null",
  "progress": 0,
  "deadline": "ISO date",
  "status": "ON_TRACK|AT_RISK",
  "createdAt": "ISO",
  "updatedAt": "ISO"
}
```

## 9. Learning/Courses APIs (`/api/v1/courses`)

1) `POST /courses`
- Body:
```json
{
  "title": "string 3..255",
  "description": "optional <=2000",
  "instructorId": "uuid"
}
```

2) `GET /courses?page=1&limit=20`

3) `GET /courses/:id`

4) `POST /courses/:id/enroll`
- Body:
```json
{ "userId": "uuid" }
```

5) `GET /courses/enrollments?page=1&limit=20&userId=<uuid>&courseId=<uuid>&status=ENROLLED|COMPLETED|DROPPED`

Enrollment item shape:
```json
{
  "enrollmentId": "uuid",
  "courseId": "uuid",
  "userId": "uuid",
  "status": "ENROLLED|COMPLETED|DROPPED",
  "progress": 0,
  "completedAt": "ISO|null",
  "createdAt": "ISO",
  "updatedAt": "ISO",
  "course": {
    "courseId": "uuid",
    "title": "string"
  }
}
```

## 10. Wellness APIs (`/api/v1/wellness`)

All wellness endpoints require JWT.

1) `POST /wellness/mood`
- Body:
```json
{
  "date": "YYYY-MM-DD",
  "mood": "VERY_LOW|LOW|NEUTRAL|GOOD|GREAT|STRESSED|FOCUSED|TIRED",
  "energyLevel": 1,
  "notes": "optional"
}
```
- `mood`, `energyLevel`, `notes` are optional; `date` required.

2) `GET /wellness`
- Query:
- `userId`, `organizationId`, `startDate`, `endDate`, `mood`, `minEnergy`, `maxEnergy`, `page`, `limit`
- Returns paginated records and includes user `name` in each item.

3) `GET /wellness/me`
- Query:
- `startDate`, `endDate`, `mood`, `minEnergy`, `maxEnergy`, `page`, `limit`
- Returns paginated records for authenticated user, without joined `name` field.

Wellness item shape:
```json
{
  "logId": "uuid",
  "userId": "uuid",
  "date": "YYYY-MM-DD",
  "mood": "enum|null",
  "energyLevel": 1,
  "notes": "string|null",
  "createdAt": "ISO",
  "updatedAt": "ISO",
  "name": "string|null (only in /wellness list)"
}
```

## 11. Notifications APIs (`/api/v1/notifications`)

Notifications router has:
- Global API rate limiter (`100 req/min`)
- JWT required for all endpoints

1) `GET /notifications?page=1&limit=20&status=READ|UNREAD`
- Returns paginated list.

2) `PATCH /notifications/read-all`
- Returns:
```json
{
  "updatedCount": 0,
  "message": "All notifications marked as read."
}
```

3) `PATCH /notifications/:id/read`
- Returns notification read status.

4) `DELETE /notifications/:id`

Notification item shape:
```json
{
  "notificationId": "uuid",
  "userId": "uuid",
  "type": "string",
  "message": "string",
  "status": "READ|UNREAD",
  "createdAt": "ISO",
  "updatedAt": "ISO"
}
```

## 12. Frontend Integration Notes for Stability

1) Build one API client wrapper that:
- Adds bearer token automatically
- Auto-refreshes tokens on `401` (once), then retries request
- Normalizes inconsistent backend shapes into one frontend shape

2) Normalize naming:
- Backend mixes `camelCase` and `snake_case`
- Map everything to `camelCase` in frontend DTO adapters

3) Error handling:
- Parse both `{ success:false, message, errors }` and custom `{ error }` / `{ message }`
- Show validation errors per field when `errors` array exists

4) Pagination:
- Reusable table/list components should expect
```json
{ "meta": { "page": 1, "limit": 20, "totalRecords": 0, "totalPages": 1 }, "data": [] }
```

## 13. AI Prompt Template to Generate UI

Use the prompt below with any UI-generation AI tool:

```text
Create a production-ready frontend UI (React + TypeScript) for a Remote Work Tracker using this API contract.

API base URL:
- http://localhost:5000/api/v1

Auth:
- Bearer JWT access token in Authorization header
- Support refresh token flow for /users/refresh-token and /organizations/refresh-token

Required modules/screens:
1) Auth
- User Sign In
- Organization Admin Login
- Change Password
- Forgot/Reset Password (organization)

2) Dashboard
- Summary cards for goals, courses, wellness, notifications
- Recent notifications list

3) Organization Management
- Create organization
- Organization profile (get by id)
- Organization users list and delete user action

- Add permission to role (single and bulk)

5) Departments
- Department list (paginated)
- Create department (single, comma mode, array mode)
- Update, delete, and reassign users between departments

6) Projects
- Projects list with pagination and organization filter
- Create/update/delete project
- Add/remove project member
- Goals list with filters (userId, status)
- Create/update/delete goal
- Update goal progress with slider (0-100)

8) Learning
- Courses list + details
- Create course
- Enroll user in course
- Enrollment list with filters (userId, courseId, status)

9) Wellness
- Mood log form (date, mood, energy, notes)
- Admin wellness logs page (filters + pagination)

10) Notifications
- Notifications list (READ/UNREAD filter)
- Mark one as read
- Mark all as read
- Delete notification

Implementation requirements:
- Use typed API service layer with request/response interfaces
- Add DTO mappers to normalize snake_case/camelCase differences
- Add centralized error handler for both wrapped and unwrapped backend errors
- Use reusable DataTable with server-side pagination meta
- Include loading, empty, and error states for every screen
- Include route guards for authenticated pages
- Keep UI responsive (desktop + mobile)

Generate:
- page structure
- API service files
- hooks for data fetching/mutations
- forms with validation
- reusable UI components
```
4) `GET /organizations/users/managers`
- Auth: Required
- Query params (optional):
  - `organizationId` - filter managers by organization UUID

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "user_id": "uuid",
      "name": "string",
      "email": "string",
      "role_id": "uuid (manager role)",
      "department_id": "uuid",
      "organization_id": "uuid",
      "region": "2-letter",
      "salary": "numeric string",
      "created_at": "ISO 8601 datetime",
      "updated_at": "ISO 8601 datetime"
    }
  ]
}
```

**Use Case:**
- Populate manager dropdowns in project creation/edit forms
- Frontend should display `name` and `email`, store `user_id` as value
- Only includes users with MANAGER role

## 14. Recommended Frontend Endpoint Priority (Build Order)

1) User auth/profile (`/users/sign-in`, `/users/profile`, `/users/refresh-token`)  
2) Notifications and dashboard essentials  
3) Goals + projects + departments  
4) Courses/enrollments  
5) Wellness  
6) Organization admin and role/permission management
