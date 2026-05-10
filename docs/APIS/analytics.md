## Analytics Module
Base route:/api/v1/analytics
1️⃣ Productivity Report (Manager / Admin / SUPER_ADMIN)
GET /analytics/productivity
Query Parameters (optional):
Parameter	Type	Description
userId	string	Filter by employee UUID
projectId	string	Filter by project
startDate	string	YYYY-MM-DD
endDate	string	YYYY-MM-DD
Response (200 OK):
{
  "meta": {
    "startDate": "2026-03-01",
    "endDate": "2026-03-07",
    "totalEmployees": 5
  },
  "data": [
    {
      "userId": "uuid-user1",
      "tasksCompleted": 12,
      "averageTaskCompletionTime": 4.5,
      "productivityScore": 85
    },
    {
      "userId": "uuid-user2",
      "tasksCompleted": 9,
      "averageTaskCompletionTime": 5.2,
      "productivityScore": 78
    }
  ]
}
Notes:
•	productivityScore → weighted score based on task completion, timeliness, goal progress
•	averageTaskCompletionTime → in hours

2️⃣ Team Performance Report (Manager / Admin / SUPER_ADMIN)
GET /analytics/team-performance
Query Parameters (optional):
Parameter	Type	Description
teamId	string	Filter by team or department
startDate	string	YYYY-MM-DD
endDate	string	YYYY-MM-DD
Response (200 OK):
{
  "meta": {
    "teamId": "uuid-team",
    "period": "2026-03-01 to 2026-03-07"
  },
  "data": [
    {
      "userId": "uuid-user1",
      "tasksAssigned": 15,
      "tasksCompleted": 12,
      "completionRate": 80,
      "attendanceScore": 95,
      "goalProgress": 85
    },
    {
      "userId": "uuid-user2",
      "tasksAssigned": 10,
      "tasksCompleted": 9,
      "completionRate": 90,
      "attendanceScore": 90,
      "goalProgress": 70
    }
  ]
}
Notes:
•	completionRate → tasksCompleted / tasksAssigned * 100
•	AttendanceScore → derived from attendance module
•	goalProgress → derived from goals module

3️⃣ Attendance Trends Report (Manager / Admin / SUPER_ADMIN)
GET /analytics/attendance-trends
Query Parameters (optional):
Parameter	Type	Description
userId	string	Filter by employee UUID
departmentId	string	Filter by department
startDate	string	YYYY-MM-DD
endDate	string	YYYY-MM-DD
Response (200 OK):
{
  "meta": {
    "startDate": "2026-03-01",
    "endDate": "2026-03-07",
    "departmentId": "uuid-dept"
  },
  "data": [
    {
      "userId": "uuid-user1",
      "totalCheckIns": 5,
      "totalCheckOuts": 5,
      "averageWorkHours": 8.2,
      "lateCheckIns": 1,
      "earlyCheckOuts": 0
    },
    {
      "userId": "uuid-user2",
      "totalCheckIns": 5,
      "totalCheckOuts": 5,
      "averageWorkHours": 7.5,
      "lateCheckIns": 2,
      "earlyCheckOuts": 1
    }
  ]
}
Notes:
•	Tracks trends over time for individual or teams
•	Can be used to feed performance reviews and compliance checks

4️⃣ Optional Enhancements
1.	Role-Based Access:
Role	Access
SUPER_ADMIN	Full access to all analytics
ADMIN	Full access to all analytics
MANAGER	Only team members under their supervision
EMPLOYEE	Only their own reports (optional)
2.	Scheduled Analytics Jobs:
•	Daily or weekly summary reports via node-cron
•	Send automated notifications to managers for low productivity, attendance issues, or compliance risks
3.	Visualization Ready:
•	Response structured for dashboards with charts, heatmaps, and KPIs

