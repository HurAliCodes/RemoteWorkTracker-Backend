## WELLNESS MODULE
Base route:/api/v1/wellness

Schema Source:
•	Based on backend/scripts/migrate-wellness_logs.ts
•	Table fields: log_id, user_id, date, mood, energy_level, notes, created_at, updated_at

1️⃣ Create Mood Log (Employee)
POST /wellness/mood
Request Body:
{
  "date": "2026-03-22",
  "mood": "FOCUSED",
  "energyLevel": 3,
  "notes": "Good progress today with minimal blockers"
}
Validation:
•	date → required string, format YYYY-MM-DD
•	mood → optional enum: VERY_LOW, LOW, NEUTRAL, GOOD, GREAT, STRESSED, FOCUSED, TIRED
•	energyLevel → optional integer (Range 1-5)
•	notes → optional text
Identity:
•	userId is taken from JWT token, not from request body
Response (201 Created):
{
  "logId": "uuid-log",
  "userId": "uuid-user",
  "date": "2026-03-22",
  "mood": "FOCUSED",
  "energyLevel": 3,
  "notes": "Good progress today with minimal blockers",
  "createdAt": "2026-03-22T17:30:02Z",
  "updatedAt": "2026-03-22T17:30:02Z"
}

2️⃣ Get Wellness Logs (Admin / Manager / SUPER_ADMIN)
GET /wellness
Query Parameters (optional):
Parameter	Type	Description
userId	string	Filter by employee UUID
organizationId	string	Filter by organization UUID
startDate	string	YYYY-MM-DD
endDate	string	YYYY-MM-DD
mood	string	Filter by mood label
minEnergy	number	Filter by minimum energy level
maxEnergy	number	Filter by maximum energy level
page	number	Pagination page (default 1)
limit	number	Records per page (default 20)
Response (200 OK):
{
  "meta": {
    "page": 1,
    "limit": 20,
    "totalRecords": 2,
    "totalPages": 1
  },
  "data": [
    {
      "logId": "uuid-log1",
      "userId": "uuid-user1",
      "name": "Ali Khan",
      "date": "2026-03-21",
      "mood": "STRESSED",
      "energyLevel": 2,
      "notes": "Back-to-back meetings",
      "createdAt": "2026-03-21T16:10:00Z",
      "updatedAt": "2026-03-21T16:10:00Z"
    },
    {
      "logId": "uuid-log2",
      "userId": "uuid-user2",
      "name": "Sara Ahmed",
      "date": "2026-03-21",
      "mood": "FOCUSED",
      "energyLevel": 4,
      "notes": "Good deep-work block",
      "createdAt": "2026-03-21T17:00:00Z",
      "updatedAt": "2026-03-21T17:00:00Z"
    }
  ]
}

3️⃣ Get My Wellness Logs (Employee)
GET /wellness/me
Query Parameters (optional):
Parameter	Type	Description
startDate	string	YYYY-MM-DD
endDate	string	YYYY-MM-DD
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
      "logId": "uuid-log1",
      "date": "2026-03-20",
      "mood": "NEUTRAL",
      "energyLevel": 3,
      "notes": "Regular day",
      "createdAt": "2026-03-20T18:00:00Z",
      "updatedAt": "2026-03-20T18:00:00Z"
    },
    {
      "logId": "uuid-log2",
      "date": "2026-03-21",
      "mood": "FOCUSED",
      "energyLevel": 4,
      "notes": "Completed sprint tasks",
      "createdAt": "2026-03-21T18:10:00Z",
      "updatedAt": "2026-03-21T18:10:00Z"
    }
  ]
}

4️⃣ Frontend Usage
POST /api/v1/wellness/mood:
•	Employee mobile check-in card (primary input)
•	Employee web home quick check-in widget
•	Best trigger: after check-out or end-of-day reminder

GET /api/v1/wellness:
•	Manager/HR web dashboard for team wellness monitoring
•	Risk list and trend widgets in analytics view

GET /api/v1/wellness/me:
•	Employee mobile mood history timeline
•	Employee web profile wellness tab

Current integration files:
•	web/app/pages/Home/Home.jsx
•	web/app/services/api/client.js
•	mobile/src/screens/Home/Home.js
•	mobile/src/services/api/client.js

5️⃣ Notes
1.	Role-Based Access:
Role	Access
EMPLOYEE	Can create mood logs and view own logs
MANAGER	Can view team wellness logs
ADMIN	Can view all wellness logs
SUPER_ADMIN	Full access
2.	Validation:
•	Use YYYY-MM-DD for date
•	Use allowed mood values only: VERY_LOW, LOW, NEUTRAL, GOOD, GREAT, STRESSED, FOCUSED, TIRED
•	Do not accept userId from request body
3.	Business Logic:
•	Map energyLevel to energy_level at DB layer
•	Use JWT identity for user_id linkage
4.	Error Responses:
{
  "error": "Invalid date format. Expected YYYY-MM-DD"
}
{
  "error": "User not allowed to view these wellness logs"
}

6️⃣ Optional Enhancements
•	Add burnoutRisk field after migration update
•	Add followUpRequired flag for repeated low-energy patterns

