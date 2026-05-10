## Department Module
Base route:/api/v1/departments
1️⃣ Create Department (Admin only)
POST /departments
Request Body:
{
  "name": "Engineering"
}
Validation:
•	name → string, min 2 characters, max 100
Response (201 Created):
{
  "departmentId": "uuid-department",
  "name": "Engineering",
  "createdAt": "2026-03-07T12:00:00Z"
}

2️⃣ Get All Departments
GET /departments
Query Parameters (optional):
Parameter	Type	Description
page	number	Pagination page (default: 1)
limit	number	Number of records per page (default: 20)
Response (200 OK):
{
  "meta": {
    "page": 1,
    "limit": 20,
    "totalRecords": 5,
    "totalPages": 1
  },
  "data": [
    {
      "departmentId": "uuid-department1",
      "name": "Engineering",
      "createdAt": "2026-03-07T12:00:00Z"
    },
    {
      "departmentId": "uuid-department2",
      "name": "HR",
      "createdAt": "2026-03-07T12:05:00Z"
    }
  ]
}

3️⃣ Get Single Department
GET /departments/:id
Response (200 OK):
{
  "departmentId": "uuid-department",
  "name": "Engineering",
  "createdAt": "2026-03-07T12:00:00Z",
  "updatedAt": "2026-03-07T12:30:00Z"
}
Errors:
•	404 Not Found → if department ID does not exist

4️⃣ Update Department (Admin only)
PATCH /departments/:id
Request Body (optional fields):
{
  "name": "Engineering & R&D"
}
Response (200 OK):
{
  "departmentId": "uuid-department",
  "name": "Engineering & R&D",
  "updatedAt": "2026-03-07T13:00:00Z"
}

5️⃣ Delete Department (Admin only)
DELETE /departments/:id
Response (200 OK):
{
  "message": "Department deleted successfully"
}
Errors:
•	403 Forbidden → if user is not Admin
•	404 Not Found → if department ID does not exist

Notes:
1.	Role-based Access Control:
Role	Access
SUPER_ADMIN	Full CRUD
ADMIN	Full CRUD
MANAGER	Read-only
EMPLOYEE	Read-only (optional, can be disabled)
2.	Validation: Use Zod or Joi for input fields
3.	Pagination: Include meta in list responses
4.	Timestamps: Always return createdAt and updatedAt
5.	Error Response Format:
{
  "error": "Department not found"
}

