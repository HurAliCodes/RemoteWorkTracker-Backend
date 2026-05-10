## GOAL AND KPI MODULE
Base route:/api/v1/goals
1️⃣ Create Goal (Admin / Manager / Employee)
POST /goals
Request Body:
{
  "title": "Improve code quality",
  "userId": "uuid-user",
  "description": "Reduce code errors and increase unit test coverage",
  "deadline": "2026-04-01"
}
Validation:
•	title → string, min 3 chars
•	userId → valid UUID of employee
•	description → optional string, max 500 chars
•	deadline → valid future date
Response (201 Created):
{
  "goalId": "uuid-goal",
  "title": "Improve code quality",
  "userId": "uuid-user",
  "description": "Reduce code errors and increase unit test coverage",
  "progress": 0,
  "deadline": "2026-04-01",
  "createdAt": "2026-03-07T12:00:00Z"
}

2️⃣ Update Goal Progress
PATCH /goals/:id/progress
Request Body:
{
  "progress": 60
}
Validation:
•	progress → number between 0 and 100
Response (200 OK):
{
  "goalId": "uuid-goal",
  "title": "Improve code quality",
  "userId": "uuid-user",
  "description": "Reduce code errors and increase unit test coverage",
  "progress": 60,
  "deadline": "2026-04-01",
  "updatedAt": "2026-03-07T13:00:00Z"
}

3️⃣ Get All Goals (Admin / Manager / Employee)
GET /goals
Query Parameters (optional):
Parameter	Type	Description
userId	string	Filter goals by employee UUID
status	string	Filter by progress: ON_TRACK (>=50%), AT_RISK (<50%)
page	number	Pagination page (default 1)
limit	number	Number of records per page (default 20)
Response (200 OK):
{
  "meta": {
    "page": 1,
    "limit": 20,
    "totalRecords": 10,
    "totalPages": 1
  },
  "data": [
    {
      "goalId": "uuid-goal1",
      "title": "Improve code quality",
      "userId": "uuid-user",
      "description": "Reduce code errors and increase unit test coverage",
      "progress": 60,
      "deadline": "2026-04-01",
      "status": "ON_TRACK",
      "createdAt": "2026-03-07T12:00:00Z"
    },
    {
      "goalId": "uuid-goal2",
      "title": "Complete React Native module",
      "userId": "uuid-user2",
      "description": "Finish the onboarding screens",
      "progress": 40,
      "deadline": "2026-03-25",
      "status": "AT_RISK",
      "createdAt": "2026-03-07T12:15:00Z"
    }
  ]
}

4️⃣ Get Single Goal
GET /goals/:id
Response (200 OK):
{
  "goalId": "uuid-goal",
  "title": "Improve code quality",
  "userId": "uuid-user",
  "description": "Reduce code errors and increase unit test coverage",
  "progress": 60,
  "deadline": "2026-04-01",
  "status": "ON_TRACK",
  "createdAt": "2026-03-07T12:00:00Z",
  "updatedAt": "2026-03-07T13:00:00Z"
}
Errors:
•	404 Not Found → if goal ID does not exist

5️⃣ Delete Goal (Admin / Manager / Employee if own goal)
DELETE /goals/:id
Response (200 OK):
{
  "message": "Goal deleted successfully"
}
Errors:
•	403 Forbidden → if user cannot delete this goal
•	404 Not Found → if goal ID does not exist

Notes:
1.	Role-Based Access:
Role	Access
SUPER_ADMIN	Full CRUD for all employees
ADMIN	Full CRUD for all employees
MANAGER	Can manage goals for team members
EMPLOYEE	Can manage own goals only
2.	Progress Status Calculation:
•	ON_TRACK → progress ≥ 50%
•	AT_RISK → progress < 50%
3.	Validation: Use Zod schemas for input validation
4.	Pagination: Use meta object for list endpoints
5.	Error Responses:
{
  "error": "Goal not found"
}
{
  "error": "User not allowed to update this goal"
}

