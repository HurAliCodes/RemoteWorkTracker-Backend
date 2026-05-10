## Project Module
Base route:/api/v1/projects
1️⃣ Create Project (Admin / Manager)
POST /projects
Request Body:
{
  "name": "Mobile App",
  "description": "Development project for iOS and Android",
  "managerId": "uuid-user",
  "startDate": "2026-03-10",
  "endDate": "2026-06-30"
}
Validation:
•	name → string, min 3 chars
•	description → string, optional max 500 chars
•	managerId → valid UUID of a user with MANAGER role
•	startDate, endDate → valid date, endDate ≥ startDate
Response (201 Created):
{
  "projectId": "uuid-project",
  "name": "Mobile App",
  "description": "Development project for iOS and Android",
  "managerId": "uuid-user",
  "startDate": "2026-03-10",
  "endDate": "2026-06-30",
  "createdAt": "2026-03-07T12:00:00Z"
}
Manager Picker Source:
Use `GET /api/v1/users/managers` (optionally with `?organizationId=<uuid>`) to fetch manager users for `managerId`.

2️⃣ Get All Projects
GET /projects
Query Parameters (optional):
Parameter	Type	Description
managerId	string	Filter projects by manager UUID
page	number	Pagination page (default 1)
limit	number	Number of records per page (default 20)
Response (200 OK):
{
  "meta": {
    "page": 1,
    "limit": 20,
    "totalRecords": 12,
    "totalPages": 1
  },
  "data": [
    {
      "projectId": "uuid-project1",
      "name": "Mobile App",
      "description": "Development project for iOS and Android",
      "managerId": "uuid-user",
      "startDate": "2026-03-10",
      "endDate": "2026-06-30",
      "createdAt": "2026-03-07T12:00:00Z"
    },
    {
      "projectId": "uuid-project2",
      "name": "Website Redesign",
      "description": "Company website UX/UI revamp",
      "managerId": "uuid-user2",
      "startDate": "2026-04-01",
      "endDate": "2026-07-15",
      "createdAt": "2026-03-07T12:30:00Z"
    }
  ]
}

3️⃣ Get Single Project
GET /projects/:id
Response (200 OK):
{
  "projectId": "uuid-project",
  "name": "Mobile App",
  "description": "Development project for iOS and Android",
  "managerId": "uuid-user",
  "startDate": "2026-03-10",
  "endDate": "2026-06-30",
  "createdAt": "2026-03-07T12:00:00Z",
  "updatedAt": "2026-03-07T12:30:00Z",
  "tasks": [
    {
      "taskId": "uuid-task1",
      "title": "Build login screen",
      "status": "IN_PROGRESS"
    }
  ]
}
Errors:
•	404 Not Found → if project ID does not exist

4️⃣ Update Project (Admin / Manager)
PATCH /projects/:id
Request Body (any fields optional):
{
  "name": "Mobile App v2",
  "description": "Updated description",
  "managerId": "uuid-user2",
  "startDate": "2026-03-15",
  "endDate": "2026-07-01"
}
Response (200 OK):
{
  "projectId": "uuid-project",
  "name": "Mobile App v2",
  "description": "Updated description",
  "managerId": "uuid-user2",
  "startDate": "2026-03-15",
  "endDate": "2026-07-01",
  "updatedAt": "2026-03-07T13:00:00Z"
}

5️⃣ Delete Project (Admin / Manager)
DELETE /projects/:id
Response (200 OK):
{
  "message": "Project deleted successfully"
}
Errors:
•	403 Forbidden → if user is not Admin or Manager
•	404 Not Found → if project ID does not exist

 Notes:
1.	Role-Based Access:
Role	Access
SUPER_ADMIN	Full CRUD
ADMIN	Full CRUD
MANAGER	Can manage projects assigned to self
EMPLOYEE	Read-only (can view assigned projects/tasks)
2.	Validation: Use Zod schemas for request bodies
3.	Pagination: Include meta object for list endpoints
4.	Nested Data: Optional to include tasks summary in GET /projects/:id
5.	Error Responses:
{
  "error": "Project not found"
}

