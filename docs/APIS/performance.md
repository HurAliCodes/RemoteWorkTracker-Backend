## Performance Module
Base route:/api/v1/performance
1️⃣ Generate Performance Review (Admin / Manager / SUPER_ADMIN)
POST /performance/generate
Request Body:
{
  "userId": "uuid-employee",
  "period": "2026-Q1"
}
Validation:
•	userId → valid employee UUID
•	period → string in format YYYY-QN (e.g., 2026-Q1)
•	Checks if a review already exists for that user/period
Response (201 Created):
{
  "reviewId": "uuid-review",
  "userId": "uuid-employee",
  "period": "2026-Q1",
  "attendanceScore": 90,
  "taskCompletionScore": 85,
  "goalProgressScore": 80,
  "wellnessScore": 70,
  "overallScore": 81.25,
  "generatedAt": "2026-03-07T12:00:00Z",
  "status": "DRAFT"
}
Notes:
•	overallScore can be a weighted average:
o	Attendance 25%
o	Task Completion 35%
o	Goal Progress 30%
o	Wellness 10%
•	status: DRAFT, FINALIZED

2️⃣ Get All Performance Reviews (Admin / Manager / SUPER_ADMIN / Employee)
GET /performance
Query Parameters (optional):
Parameter	Type	Description
userId	string	Filter by employee UUID
period	string	Filter by period (YYYY-QN)
status	string	DRAFT / FINALIZED
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
      "reviewId": "uuid-review1",
      "userId": "uuid-employee1",
      "period": "2026-Q1",
      "attendanceScore": 95,
      "taskCompletionScore": 88,
      "goalProgressScore": 80,
      "wellnessScore": 75,
      "overallScore": 84.5,
      "status": "FINALIZED",
      "generatedAt": "2026-03-07T12:00:00Z"
    },
    {
      "reviewId": "uuid-review2",
      "userId": "uuid-employee2",
      "period": "2026-Q1",
      "attendanceScore": 85,
      "taskCompletionScore": 80,
      "goalProgressScore": 75,
      "wellnessScore": 70,
      "overallScore": 77.25,
      "status": "DRAFT",
      "generatedAt": "2026-03-07T12:15:00Z"
    }
  ]
}

3️⃣ Get Single Performance Review
GET /performance/:id
Response (200 OK):
{
  "reviewId": "uuid-review",
  "userId": "uuid-employee",
  "period": "2026-Q1",
  "attendanceScore": 90,
  "taskCompletionScore": 85,
  "goalProgressScore": 80,
  "wellnessScore": 70,
  "overallScore": 81.25,
  "status": "DRAFT",
  "generatedAt": "2026-03-07T12:00:00Z",
  "finalizedAt": null,
  "comments": "Needs improvement in wellness and goal progress"
}
Errors:
•	404 Not Found → if review ID does not exist
•	403 Forbidden → if employee tries to access another user’s review

4️⃣ Finalize Review (Admin / Manager / SUPER_ADMIN)
PATCH /performance/:id/finalize
Request Body: (optional, can include comments)
{
  "comments": "Excellent performance overall, keep up the good work."
}
Response (200 OK):
{
  "reviewId": "uuid-review",
  "status": "FINALIZED",
  "finalizedAt": "2026-03-07T13:00:00Z",
  "comments": "Excellent performance overall, keep up the good work."
}
Validation:
•	Only Admin / Manager / SUPER_ADMIN can finalize
•	Cannot finalize if review already FINALIZED

5️⃣ Notes & Best Practices
1.	Role-Based Access
Role	Access
SUPER_ADMIN	Full CRUD, generate, finalize all reviews
ADMIN	Full CRUD, generate, finalize all reviews
MANAGER	Generate and finalize reviews for team members
EMPLOYEE	View own reviews only
2.	Automatic Review Generation:
•	Pull attendance logs, task completion, goals/KPIs, wellness scores from respective modules
•	Weighted scoring system (adjustable per business rules)
•	Saves as DRAFT by default; can later finalize
3.	Error Responses:
{
  "error": "Review not found"
}
{
  "error": "User not allowed to generate or finalize this review"
}
4.	Pagination: Always return meta object for list endpoints
5.	Optional Extensions:
•	Attach task comments, goals completed, or project contributions in review detail
•	Trigger notifications to employee when review is generated or finalized

