## PAYROLL MODULE

Base route:/api/v1/payroll
1️⃣ Generate Payroll (Admin / SUPER_ADMIN)
POST /payroll/generate
Request Body:
{
  "month": "2026-03"
}
Validation:
•	month → string in YYYY-MM format
•	Payroll generation checks attendance, overtime, and bonuses automatically
Response (201 Created):
{
  "payrollId": "uuid-payroll",
  "month": "2026-03",
  "generatedAt": "2026-03-07T12:00:00Z",
  "entriesGenerated": 25
}
Notes:
•	Payroll entries for all employees are created
•	Can include overtime, bonuses, deductions

2️⃣ Get Payroll List (Admin / SUPER_ADMIN / Manager)
GET /payroll
Query Parameters (optional):
Parameter	Type	Description
userId	string	Filter by employee UUID
month	string	YYYY-MM format
page	number	Pagination page (default 1)
limit	number	Records per page (default 20)
Response (200 OK):
{
  "meta": {
    "page": 1,
    "limit": 20,
    "totalRecords": 25,
    "totalPages": 2
  },
  "data": [
    {
      "payrollId": "uuid-payroll1",
      "userId": "uuid-user1",
      "employeeName": "Ali Khan",
      "month": "2026-03",
      "basicSalary": 1200,
      "overtime": 50,
      "bonus": 100,
      "deductions": 20,
      "netPay": 1330,
      "status": "PAID",
      "generatedAt": "2026-03-07T12:00:00Z"
    },
    {
      "payrollId": "uuid-payroll2",
      "userId": "uuid-user2",
      "employeeName": "Sara Ahmed",
      "month": "2026-03",
      "basicSalary": 1500,
      "overtime": 30,
      "bonus": 80,
      "deductions": 50,
      "netPay": 1560,
      "status": "PAID",
      "generatedAt": "2026-03-07T12:00:00Z"
    }
  ]
}

3️⃣ Get Payslip (Employee / Admin / SUPER_ADMIN)
GET /payroll/:id
Response (200 OK):
{
  "payrollId": "uuid-payroll",
  "userId": "uuid-user",
  "employeeName": "Ali Khan",
  "month": "2026-03",
  "basicSalary": 1200,
  "overtime": 50,
  "bonus": 100,
  "deductions": 20,
  "netPay": 1330,
  "status": "PAID",
  "generatedAt": "2026-03-07T12:00:00Z",
  "approvedBy": "uuid-admin",
  "approvedAt": "2026-03-07T12:30:00Z"
}
Errors:
•	403 Forbidden → if employee tries to view someone else’s payslip
•	404 Not Found → if payroll ID does not exist

 Notes:
1.	Role-Based Access:
Role	Access
SUPER_ADMIN	Generate payroll, view all entries
ADMIN	Generate payroll, view all entries
MANAGER	View payroll of team members
EMPLOYEE	View own payslip only
2.	Payroll Calculation Logic:
•	netPay = basicSalary + overtime + bonus - deductions
•	Can be extended to include tax, insurance, and benefits
3.	Validation: Use Zod schemas for month and other fields
4.	Pagination: Include meta object for listing endpoint
5.	Error Responses:
{
  "error": "Payroll not found"
}
{
  "error": "User not allowed to view this payroll"
}

