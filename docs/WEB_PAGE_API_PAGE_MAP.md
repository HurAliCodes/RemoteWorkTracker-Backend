# Web Page and API Mapping Document

Last updated: 2026-03-23
Backend source: mounted routes in src/app.ts and module controllers/services/validations.

## 1) Platform Scope

Frontend has two main experiences:
1. User experience: usable on mobile and desktop.
2. Admin organization panel: web desktop first, mobile adaptive for quick actions.

Backend API base (portal Express on port **5000**):
- http://localhost:5000/api/v1

Next.js web app (dev): http://localhost:3000 — see repo root `PORTS.md`.

Mounted modules currently available:
- /users
- /organizations
- /roles
- /departments
- /projects
- /goals
- /courses
- /wellness
- /notifications

Not exposed yet (do not design production pages depending on these yet):
- analytics
- attendance
- activity

## 2) Global UI and Technical Rules

### Layout behavior by device
- Desktop user app: left sidebar + top bar + content area.
- Mobile user app: bottom tabs + compact header + stacked cards.
- Admin panel desktop: sidebar with management modules, table-heavy views.
- Admin mobile: filter-first lists, action drawer for CRUD operations.

### Shared UI sections on almost all authenticated pages
- Header: page title, quick search (optional), notifications bell, profile menu.
- Main content: page-specific cards/table/forms.
- Feedback layer: loading skeleton, empty state, inline validation, toast messages.

### Shared API handling behavior
- Add Authorization Bearer token for protected APIs.
- Handle inconsistent backend response shapes using client adapter:
  - wrapped success:false/true format
  - custom raw JSON in some endpoints
- 401 handling: attempt refresh token flow once, retry original request.

## 3) Public Pages

## 3.1 User Sign In Page
Purpose:
- Authenticate standard employee/manager user.

Sections needed:
- Brand area
- Sign in form (email, password)
- Remember me toggle (frontend only)
- Forgot password shortcut (if routed to organization flow, label clearly)

Primary API:
- POST /users/sign-in

Request body:
- email
- password

On success:
- save accessToken and refreshToken
- save minimal user object in auth store
- redirect to User Dashboard

States:
- validation errors (bad email/password format)
- auth error (invalid credentials)
- network failure

Device notes:
- Mobile: full-screen single-column card, larger tap targets.
- Desktop: centered form with side illustration panel.

## 3.2 Organization Admin Login Page
Purpose:
- Authenticate organization admin for admin panel.

Sections needed:
- Admin login form (email, password)
- Forgot password link

Primary API:
- POST /organizations/login

On success:
- store accessToken and refreshToken
- store organization context (organizationId, organizationName)
- redirect to Admin Dashboard

Device notes:
- Desktop priority layout.
- Mobile support with compact card and sticky submit button.

## 3.3 Organization Forgot Password Page
Purpose:
- Request reset code for org admin email.

Sections:
- email input
- send code action

API:
- POST /organizations/forgot-password

## 3.4 Organization Reset Password Page
Purpose:
- complete password reset.

Sections:
- resetCode input (6 digits)
- newPassword input
- confirmPassword input (frontend)

API:
- POST /organizations/reset-password

## 4) User Application Pages (Mobile + Desktop)

## 4.1 User Dashboard Page
Purpose:
- quick personal overview for goals, courses, wellness, notifications.

Sections:
- summary cards:
  - active goals count
  - at risk goals count
  - enrolled courses count
  - unread notifications count
- recent goals list
- recent wellness entries
- recent notifications list

APIs used:
- GET /goals?userId={me}&page=1&limit=5
- GET /courses/enrollments?userId={me}&page=1&limit=5
- GET /wellness/me?page=1&limit=5
- GET /notifications?page=1&limit=5&status=UNREAD

Actions:
- quick add wellness log
- quick open goal detail
- mark all notifications read

## 4.2 My Profile Page
Purpose:
- view and update user profile details.

Sections:
- profile info card
- editable form fields (name, region, email)
- account metadata (roleId, departmentId, organizationId)

APIs:
- GET /users/profile
- PATCH /users/profile

Additional action:
- Change password modal or separate page
- POST /users/change-password

## 4.3 Notifications Page
Purpose:
- list and manage personal notifications.

Sections:
- filter tabs: All, Unread, Read
- paginated list
- row actions: mark read, delete
- top action: mark all read

APIs:
- GET /notifications?page={p}&limit={l}&status={READ|UNREAD}
- PATCH /notifications/{id}/read
- PATCH /notifications/read-all
- DELETE /notifications/{id}

## 4.4 My Goals Page
Purpose:
- track goals and update progress.

Sections:
- filter bar: status, pagination controls
- goals table (desktop) / cards (mobile)
- create goal drawer/modal
- edit goal drawer/modal
- progress update slider control

APIs:
- GET /goals?userId={me}&status={ON_TRACK|AT_RISK}&page={p}&limit={l}
- POST /goals
- PATCH /goals/{id}
- PATCH /goals/{id}/progress
- DELETE /goals/{id}

Important field rules:
- deadline must be future date
- progress range 0-100

## 4.5 My Learning Page
Purpose:
- browse courses and track enrollments.

Sections:
- course catalog list
- enrollment list with status chips
- enroll action button per course

APIs:
- GET /courses?page={p}&limit={l}
- GET /courses/{id}
- POST /courses/{id}/enroll
- GET /courses/enrollments?userId={me}&page={p}&limit={l}&status={ENROLLED|COMPLETED|DROPPED}

## 4.6 Wellness Page
Purpose:
- log daily mood/energy and view history.

Sections:
- new log form:
  - date
  - mood enum selector
  - energy level 1-5
  - notes
- history list with filters:
  - date range
  - mood
  - min/max energy

APIs:
- POST /wellness/mood
- GET /wellness/me?startDate=&endDate=&mood=&minEnergy=&maxEnergy=&page=&limit=

## 4.7 Projects Read View Page
Purpose:
- user can view project details and membership info where relevant.

Sections:
- project list
- project details panel
- members list (read-only for user unless role allows)

APIs:
- GET /projects?page={p}&limit={l}&organization_id={orgId}
- GET /projects/{id}

## 5) Admin Organization Panel Pages

## 5.1 Admin Dashboard
Purpose:
- org-level operational overview.

Sections:
- KPI cards: total users, total departments, total projects, unread notifications
- quick actions: create user, create department, create project
- risk panels: at-risk goals, low wellness signals

APIs:
- GET /organizations/{id}
- GET /organizations/users
- GET /departments?page=1&limit=5
- GET /projects?page=1&limit=5&organization_id={orgId}
- GET /goals?page=1&limit=10&status=AT_RISK
- GET /wellness?organizationId={orgId}&page=1&limit=10

## 5.2 Organization Profile and Security Page
Purpose:
- view organization profile and update admin security.

Sections:
- organization details card
- admin credentials section
- change password form

APIs:
- GET /organizations/{id}
- POST /organizations/change-admin-password
- POST /organizations/logout

## 5.3 User Management Page
Purpose:
- manage organization users.

Sections:
- users table/cards
- invite/register user form
- delete user action
- filters: role, department, search text

APIs:
- GET /organizations/users
- POST /organizations/register
- DELETE /organizations/users/{id}

Form fields for register:
- name
- email
- password
- roleId
- departmentId
- organizationId
- region
- salary

## 5.4 Roles and Permissions Page
Purpose:
- define roles and attach permissions.

Sections:
- roles list
- create role form
- edit role form
- permission assignment panel (single or multi)

APIs:
- GET /roles
- POST /roles
- GET /roles/{id}
- PATCH /roles/{id}
- DELETE /roles/{id}
- POST /roles/add-permission

Permission payload modes:
- role_id + permission
- role_id + permissions[]

## 5.5 Departments Page
Purpose:
- create and maintain departments and user reassignments.

Sections:
- departments list with pagination
- create department form (single, comma-separated, or bulk array mode)
- edit department action
- delete department action
- reassign users form

APIs:
- GET /departments?page={p}&limit={l}
- POST /departments
- GET /departments/{id}
- PATCH /departments/{id}
- DELETE /departments/{id}
- PUT /departments/reassign-users

Reassign form fields:
- fromDepartmentId
- toDepartmentId

## 5.6 Projects Management Page
Purpose:
- create projects and manage members.

Sections:
- project list with org filter
- create/edit project modal
- project members management panel

APIs:
- GET /projects?page={p}&limit={l}&organization_id={orgId}
- POST /projects
- GET /projects/{id}
- PATCH /projects/{id}
- DELETE /projects/{id}
- POST /projects/{id}/members
- DELETE /projects/{id}/members/{userId}

Create/edit fields:
- name
- description
- manager_id
- organization_id
- start_date
- end_date

## 5.7 Goals Oversight Page
Purpose:
- monitor employee goals and intervene on at-risk items.

Sections:
- goals table with filters (userId, status)
- goal detail side panel
- create/edit/delete actions
- inline progress updates

APIs:
- GET /goals?userId=&status=&page=&limit=
- POST /goals
- GET /goals/{id}
- PATCH /goals/{id}
- PATCH /goals/{id}/progress
- DELETE /goals/{id}

## 5.8 Learning and Enrollment Admin Page
Purpose:
- manage courses and monitor enrollments.

Sections:
- create course form
- courses list
- enroll specific users in course
- enrollment table with status filters

APIs:
- POST /courses
- GET /courses?page=&limit=
- GET /courses/{id}
- POST /courses/{id}/enroll
- GET /courses/enrollments?page=&limit=&userId=&courseId=&status=

## 5.9 Wellness Monitoring Page
Purpose:
- track wellbeing trends by organization/user/date.

Sections:
- filter bar: organizationId, userId, date range, mood, energy range
- wellness logs table/cards
- export placeholder button (frontend only until backend export exists)

APIs:
- GET /wellness?organizationId=&userId=&startDate=&endDate=&mood=&minEnergy=&maxEnergy=&page=&limit=

## 5.10 Admin Notifications Page
Purpose:
- manage admin account notifications.

Sections:
- list + filters
- mark read
- mark all read
- delete notification

APIs:
- GET /notifications?page=&limit=&status=
- PATCH /notifications/{id}/read
- PATCH /notifications/read-all
- DELETE /notifications/{id}

## 6) Route Guards and Access Matrix

Minimum frontend route protection:
- User routes: require user JWT from /users/sign-in.
- Admin routes: require admin JWT from /organizations/login.

Recommended access map:
- User app pages:
  - Dashboard, Profile, Goals, Learning, Wellness, Notifications, Projects read view
- Admin panel pages:
  - Organization profile, Users, Roles, Departments, Projects, Goals oversight, Learning admin, Wellness monitoring

## 7) Reusable Components Needed Across Pages

- AppShell (desktop sidebar + mobile navigation)
- DataTable with server-side pagination
- FilterBar component
- CreateEditModal component
- ConfirmDialog for destructive actions
- AuthGuard and RoleGuard
- APIErrorBanner and EmptyState views
- TokenRefreshInterceptor service

## 8) API Contracts to Model in Frontend Types

Core pagination contract:
- meta:
  - page
  - limit
  - totalRecords
  - totalPages
- data: array

Core entities:
- UserProfile
- Organization
- Role
- Department
- Project
- Goal
- Course
- Enrollment
- WellnessLog
- Notification

## 9) MVP Build Order

1. User and admin login flows
2. Shared shell/navigation and auth guards
3. User Dashboard + Notifications + Profile
4. Admin Users + Departments + Roles
5. Projects management
6. Goals pages
7. Courses and enrollments
8. Wellness pages

## 10) Known Backend Gaps to Consider in UI Prompt

- Inconsistent response wrappers across endpoints.
- Mixed snake_case and camelCase fields.
- Some modules exist in code but are not mounted.
- Keep adapter layer mandatory in generated frontend code.
