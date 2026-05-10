## TASK MODULE
Base route:/api/v1/tasks
1️⃣ Create Task (Admin / Manager)
POST /tasks
Request Body:
{
  "title": "Build login screen",
  "description": "React Native login feature",
  "assignedTo": "uuid-user",
  "projectId": "uuid-project",
  "priority": "HIGH",
  "deadline": "2026-03-20"
}
Validation:
•	title → string, min 3 chars
•	description → optional string, max 500 chars
•	assignedTo → valid UUID of employee
•	projectId → valid UUID of project
•	priority → enum: LOW, MEDIUM, HIGH
•	deadline → valid date, not in the past
Response (201 Created):
{
  "taskId": "uuid-task",
  "title": "Build login screen",
  "description": "React Native login feature",
  "assignedTo": "uuid-user",
  "projectId": "uuid-project",
  "priority": "HIGH",
  "status": "PENDING",
  "deadline": "2026-03-20",
  "createdAt": "2026-03-07T12:00:00Z"
}

2️⃣ Get All Tasks
GET /tasks
Query Parameters (optional):
Parameter	Type	Description
assignedTo	string	Employee UUID
projectId	string	Project UUID
status	string	PENDING, IN_PROGRESS, COMPLETED
priority	string	LOW, MEDIUM, HIGH
page	number	Pagination page (default 1)
limit	number	Number of records per page (default 20)
Response (200 OK):
{
  "meta": {
    "page": 1,
    "limit": 20,
    "totalRecords": 35,
    "totalPages": 2
  },
  "data": [
    {
      "taskId": "uuid-task1",
      "title": "Build login screen",
      "assignedTo": "uuid-user",
      "projectId": "uuid-project",
      "priority": "HIGH",
      "status": "IN_PROGRESS",
      "deadline": "2026-03-20",
      "createdAt": "2026-03-07T12:00:00Z"
    },
    {
      "taskId": "uuid-task2",
      "title": "Design homepage",
      "assignedTo": "uuid-user2",
      "projectId": "uuid-project2",
      "priority": "MEDIUM",
      "status": "PENDING",
      "deadline": "2026-03-25",
      "createdAt": "2026-03-07T12:15:00Z"
    }
  ]
}

3️⃣ Get Single Task
GET /tasks/:id
Response (200 OK):
{
  "taskId": "uuid-task",
  "title": "Build login screen",
  "description": "React Native login feature",
  "assignedTo": "uuid-user",
  "projectId": "uuid-project",
  "priority": "HIGH",
  "status": "IN_PROGRESS",
  "deadline": "2026-03-20",
  "createdAt": "2026-03-07T12:00:00Z",
  "updatedAt": "2026-03-07T13:00:00Z",
  "comments": [
    {
      "commentId": "uuid-comment1",
      "userId": "uuid-user2",
      "comment": "Started working on it",
      "createdAt": "2026-03-07T12:30:00Z"
    }
  ]
}
Errors:
•	404 Not Found → if task ID does not exist

4️⃣ Update Task (Admin / Manager / Assigned Employee)
PATCH /tasks/:id
Request Body (any fields optional):
{
  "title": "Build login & signup screens",
  "description": "Updated description",
  "assignedTo": "uuid-user3",
  "priority": "MEDIUM",
  "status": "IN_PROGRESS",
  "deadline": "2026-03-22"
}
Response (200 OK):
{
  "taskId": "uuid-task",
  "title": "Build login & signup screens",
  "description": "Updated description",
  "assignedTo": "uuid-user3",
  "projectId": "uuid-project",
  "priority": "MEDIUM",
  "status": "IN_PROGRESS",
  "deadline": "2026-03-22",
  "updatedAt": "2026-03-07T13:30:00Z"
}

5️⃣ Delete Task (Admin / Manager)
DELETE /tasks/:id
Response (200 OK):
{
  "message": "Task deleted successfully"
}
Errors:
•	403 Forbidden → if user is not allowed
•	404 Not Found → if task ID does not exist

6️⃣ Task Comments
a) Add Comment (Assigned Employee / Admin / Manager)
POST /tasks/:taskId/comments
Request Body:
{
  "comment": "Started working on the login screen"
}
Response (201 Created):
{
  "commentId": "uuid-comment",
  "taskId": "uuid-task",
  "userId": "uuid-user",
  "comment": "Started working on the login screen",
  "createdAt": "2026-03-07T12:45:00Z"
}
b) Get Comments
GET /tasks/:taskId/comments
Response (200 OK):
{
  "taskId": "uuid-task",
  "comments": [
    {
      "commentId": "uuid-comment1",
      "userId": "uuid-user2",
      "comment": "Started working on it",
      "createdAt": "2026-03-07T12:30:00Z"
    },
    {
      "commentId": "uuid-comment2",
      "userId": "uuid-user3",
      "comment": "Blocked by API issue",
      "createdAt": "2026-03-07T12:55:00Z"
    }
  ]
}

 Notes:
1.	Role-Based Access:
Role	Access
SUPER_ADMIN	Full CRUD
ADMIN	Full CRUD
MANAGER	Can manage tasks in projects they manage
EMPLOYEE	Can update status/comment if assigned
2.	Validation: Use Zod schemas for all inputs.
3.	Priority & Status Enums:
•	priority → LOW, MEDIUM, HIGH
•	status → PENDING, IN_PROGRESS, COMPLETED
4.	Pagination: Use meta object for GET /tasks
5.	Error Responses:
{
  "error": "Task not found"
}
{
  "error": "User not allowed to update this task"
}

