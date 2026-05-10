## Compliance Module
Base route:/api/v1/compliance
1️⃣ Create Compliance Rule (Admin / SUPER_ADMIN)
POST /compliance/rules
Request Body:
{
  "region": "EU",
  "maxWeeklyHours": 48,
  "overtimeAllowed": true,
  "minBreakHours": 11
}
Validation:
•	region → string (ISO region code or name)
•	maxWeeklyHours → number, must be >0
•	overtimeAllowed → boolean
•	minBreakHours → number
Response (201 Created):
{
  "ruleId": "uuid-rule",
  "region": "EU",
  "maxWeeklyHours": 48,
  "overtimeAllowed": true,
  "minBreakHours": 11,
  "createdAt": "2026-03-07T12:00:00Z"
}

2️⃣ Get All Compliance Rules (Admin / SUPER_ADMIN)
GET /compliance/rules
Query Parameters (optional):
Parameter	Type	Description
region	string	Filter by region
page	number	Pagination page (default 1)
limit	number	Records per page (default 20)
Response (200 OK):
{
  "meta": {
    "page": 1,
    "limit": 20,
    "totalRecords": 3,
    "totalPages": 1
  },
  "data": [
    {
      "ruleId": "uuid-rule1",
      "region": "EU",
      "maxWeeklyHours": 48,
      "overtimeAllowed": true,
      "minBreakHours": 11,
      "createdAt": "2026-03-01T09:00:00Z"
    }
  ]
}

3️⃣ Update Compliance Rule (Admin / SUPER_ADMIN)
PATCH /compliance/rules/:id
Request Body:
{
  "maxWeeklyHours": 50,
  "overtimeAllowed": false
}
Response (200 OK):
{
  "ruleId": "uuid-rule",
  "region": "EU",
  "maxWeeklyHours": 50,
  "overtimeAllowed": false,
  "minBreakHours": 11,
  "updatedAt": "2026-03-07T13:00:00Z"
}

4️⃣ Delete Compliance Rule (Admin / SUPER_ADMIN)
DELETE /compliance/rules/:id
Response (200 OK):
{
  "message": "Compliance rule deleted successfully"
}

5️⃣ Get Compliance Violations (Admin / SUPER_ADMIN / Manager)
GET /compliance/violations
Query Parameters (optional):
Parameter	Type	Description
userId	string	Filter violations for specific employee
region	string	Filter by employee region
startDate	string	YYYY-MM-DD
endDate	string	YYYY-MM-DD
status	string	RESOLVED / PENDING
page	number	Pagination page (default 1)
limit	number	Records per page (default 20)
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
      "violationId": "uuid-viol1",
      "userId": "uuid-user1",
      "ruleId": "uuid-rule1",
      "description": "Exceeded weekly working hours (52 > 48)",
      "status": "PENDING",
      "createdAt": "2026-03-05T10:00:00Z",
      "resolvedAt": null
    },
    {
      "violationId": "uuid-viol2",
      "userId": "uuid-user2",
      "ruleId": "uuid-rule2",
      "description": "Missing mandatory break (9 < 11 hours)",
      "status": "RESOLVED",
      "createdAt": "2026-03-06T14:30:00Z",
      "resolvedAt": "2026-03-06T18:00:00Z"
    }
  ]
}

6️⃣ Notes
1.	Role-Based Access
Role	Access
SUPER_ADMIN	Full CRUD on rules, view all violations
ADMIN	Full CRUD on rules, view all violations
MANAGER	View violations of team members only
EMPLOYEE	No access to rules or violations
2.	Violation Generation
•	Can be automated via scheduled jobs (node-cron):
o	Daily check on attendance, work sessions, task logs
o	Compare against region-specific compliance rules
o	Create compliance_violations records for any violations
3.	Error Responses
{
  "error": "Compliance rule not found"
}
{
  "error": "User not allowed to view these violations"
}
4.	Optional Enhancements
•	Trigger notifications to managers/employees when violations occur
•	Include violation severity or automated warnings
•	Provide audit-ready reports for HR/legal compliance

