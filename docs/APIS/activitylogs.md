## Activity log Module
Base route:/api/v1/activity-logs

1️⃣ Get Activity Logs (Admin / Manager / SUPER_ADMIN)
GET /activity-logs
Query Parameters (optional):
Parameter	Type	Description
userId	string	Filter by employee UUID
action	string	Filter by action type (LOGIN, CHECKIN, TASK_CREATED, etc.)
startDate	string	Filter start date (YYYY-MM-DD)
endDate	string	Filter end date (YYYY-MM-DD)
page	number	Pagination page (default 1)
limit	number	Records per page (default 20)
Response (200 OK)
{
  "meta": {
    "page": 1,
    "limit": 20,
    "totalRecords": 5,
    "totalPages": 1
  },
  "data": [
    {
      "activityId": "uuid-activity1",
      "userId": "uuid-user1",
      "action": "LOGIN",
      "description": "User logged in successfully",
      "ipAddress": "192.168.1.10",
      "device": "Chrome Desktop",
      "createdAt": "2026-03-07T09:00:00Z"
    },
    {
      "activityId": "uuid-activity2",
      "userId": "uuid-user2",
      "action": "CHECKIN",
      "description": "User checked in at office location",
      "ipAddress": "192.168.1.12",
      "device": "Mobile App",
      "createdAt": "2026-03-07T09:15:00Z"
    }
  ]
}

2️⃣ Record Activity (Internal / Automated)
POST /activity-logs
Request Body: (usually called internally by services like auth, tasks, attendance, etc.)
{
  "userId": "uuid-user",
  "action": "TASK_UPDATED",
  "description": "Task 'Build login screen' status changed to IN_PROGRESS",
  "ipAddress": "192.168.1.15",
  "device": "React Native App"
}
Response (201 Created):
{
  "activityId": "uuid-activity",
  "userId": "uuid-user",
  "action": "TASK_UPDATED",
  "description": "Task 'Build login screen' status changed to IN_PROGRESS",
  "ipAddress": "192.168.1.15",
  "device": "React Native App",
  "createdAt": "2026-03-07T12:45:00Z"
}

3️⃣ Notes & Best Practices
1.	Tracked Actions:
•	Auth: LOGIN, LOGOUT, PASSWORD_RESET
•	Attendance: CHECKIN, CHECKOUT
•	Tasks: TASK_CREATED, TASK_UPDATED, TASK_DELETED
•	Goals/KPIs: GOAL_CREATED, GOAL_PROGRESS_UPDATED
•	Payroll: PAYSLIP_GENERATED
•	Compliance: VIOLATION_CREATED
2.	Role-Based Access:
Role	Access
SUPER_ADMIN	View all activity logs
ADMIN	View all activity logs
MANAGER	View activity logs of team members
EMPLOYEE	View own activity logs only
3.	Indexing in Database:
•	user_id → for quick filtering by employee
•	action → filter by action type
•	created_at → for date-range queries
4.	Optional Enhancements:
•	Trigger notifications for critical actions (e.g., compliance violation created)
•	Integrate with analytics module to generate trends of user activity
•	Include audit-ready export for HR/legal purposes

