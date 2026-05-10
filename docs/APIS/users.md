## User Module
Basic Route:/api/v1/users
1️⃣ Create Employee (Admin only)
POST /users
Request Body:
{
  "name": "Ali Khan",
  "email": "ali@company.com",
  "roleId": "uuid-role",
  "departmentId": "uuid-department",
  "region": "PK",
  "salary": 1200
}
Validation:
•	name → string, min 3 characters
•	email → valid email
•	roleId, departmentId → UUID
•	salary → number ≥ 0
•	region → ISO 3166-1 alpha-2
Response (201 Created):
{
  "userId": "uuid-user",
  "name": "Ali Khan",
  "email": "ali@company.com",
  "role": "EMPLOYEE",
  "departmentId": "uuid-department",
  "region": "PK",
  "salary": 1200,
  "createdAt": "2026-03-07T12:00:00Z"
}

2️⃣ Get All Employees
GET /users
Query Parameters:
Parameter	Type	Description
page	number	Pagination page (default: 1)
limit	number	Number of records per page (default: 20)
departmentId	string	Optional, filter by department UUID
role	string	Optional, filter by role
Response (200 OK):
{
  "meta": {
    "page": 1,
    "limit": 20,
    "totalRecords": 56,
    "totalPages": 3
  },
  "data": [
    {
      "userId": "uuid-user1",
      "name": "Ali Khan",
      "email": "ali@company.com",
      "role": "EMPLOYEE",
      "departmentId": "uuid-department",
      "region": "PK",
      "salary": 1200
    },
    {
      "userId": "uuid-user2",
      "name": "Sara Ahmed",
      "email": "sara@company.com",
      "role": "MANAGER",
      "departmentId": "uuid-department",
      "region": "PK",
      "salary": 2500
    }
  ]
}

3️⃣ Get Single Employee
GET /users/:id
Response (200 OK):
{
  "userId": "uuid-user",
  "name": "Ali Khan",
  "email": "ali@company.com",
  "role": "EMPLOYEE",
  "departmentId": "uuid-department",
  "region": "PK",
  "salary": 1200,
  "createdAt": "2026-03-07T12:00:00Z",
  "updatedAt": "2026-03-07T12:30:00Z"
}
Errors:
•	404 Not Found → if user ID doesn’t exist

4️⃣ Update Employee (Admin / Manager)
PATCH /users/:id
Request Body (any fields optional):
{
  "name": "Ali Updated",
  "departmentId": "uuid-department",
  "roleId": "uuid-role",
  "region": "PK",
  "salary": 1300
}
Response (200 OK):
{
  "userId": "uuid-user",
  "name": "Ali Updated",
  "email": "ali@company.com",
  "role": "EMPLOYEE",
  "departmentId": "uuid-department",
  "region": "PK",
  "salary": 1300,
  "updatedAt": "2026-03-07T13:00:00Z"
}

5️⃣ Delete Employee (Admin only)
DELETE /users/:id
Response (200 OK):
{
  "message": "User deleted successfully"
}
Errors:
•	403 Forbidden → if not admin
•	404 Not Found → if user ID doesn’t exist

6️⃣ Get My Profile (Authenticated Employee)
GET /users/me
Headers:
Authorization: Bearer <accessToken>
Response (200 OK):
{
  "userId": "uuid-user",
  "name": "Ali Khan",
  "email": "ali@company.com",
  "role": "EMPLOYEE",
  "departmentId": "uuid-department",
  "region": "PK",
  "salary": 1200,
  "createdAt": "2026-03-07T12:00:00Z",
  "updatedAt": "2026-03-07T12:30:00Z"
}

7️⃣ Update My Profile (Authenticated Employee)
PATCH /users/me
Request Body (optional fields):
{
  "name": "Ali Personal Update",
  "region": "PK"
}
Response (200 OK):
{
  "userId": "uuid-user",
  "name": "Ali Personal Update",
  "email": "ali@company.com",
  "role": "EMPLOYEE",
  "departmentId": "uuid-department",
  "region": "PK",
  "salary": 1200,
  "updatedAt": "2026-03-07T13:30:00Z"
}

8️⃣ Get Managers (Authenticated)
GET /users/managers
Headers:
Authorization: Bearer <accessToken>
Query Parameters (optional):
Parameter	Type	Description
organizationId	string	Filter managers by organization UUID
Response (200 OK):
{
  "success": true,
  "message": "Managers fetched successfully",
  "data": [
    {
      "userId": "uuid-user2",
      "name": "Sara Ahmed",
      "email": "sara@company.com",
      "roleId": "uuid-role-manager",
      "departmentId": "uuid-department",
      "organizationId": "uuid-organization",
      "region": "PK",
      "createdAt": "2026-03-07T12:00:00Z",
      "updatedAt": "2026-03-07T12:30:00Z"
    }
  ]
}
Use Case:
•	Populate manager dropdowns on project create/update screens.

9️⃣ Extra Useful Endpoints
Get Employee Attendance
GET /users/:id/attendance
Query: ?startDate=2026-03-01&endDate=2026-03-07
Response:
{
  "userId": "uuid-user",
  "attendanceLogs": [
    {
      "checkIn": "2026-03-01T09:00:00Z",
      "checkOut": "2026-03-01T18:00:00Z",
      "status": "PRESENT"
    }
  ]
}
Get Employee Tasks
GET /users/:id/tasks
Query: ?status=IN_PROGRESS
Response:
{
  "userId": "uuid-user",
  "tasks": [
    {
      "taskId": "uuid-task",
      "title": "Build login screen",
      "status": "IN_PROGRESS",
      "priority": "HIGH",
      "deadline": "2026-03-20"
    }
  ]
}

Notes:
1.	Role-based Access:
o	Admin → CRUD on all users
o	Manager → Read / update employees in their team
o	Employee → Read / update self only
2.	Pagination: Always include meta info in list responses (page, limit, totalRecords, totalPages)
3.	Validation: Use Zod schemas for request bodies
4.	Error responses:
{
  "error": "User not found"
}

