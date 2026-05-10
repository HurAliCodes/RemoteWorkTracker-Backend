## Learning Module
Base route: /api/v1/courses

### 1) Create Course
POST /api/v1/courses

Request body:
```json
{
  "title": "TypeScript Fundamentals",
  "description": "Learn TS basics and best practices",
  "instructorId": "11111111-1111-1111-1111-111111111111"
}
```

Response (201):
```json
{
  "success": true,
  "message": "Course created successfully",
  "data": {
    "courseId": "uuid-course1",
    "title": "TypeScript Fundamentals",
    "description": "Learn TS basics and best practices",
    "instructorId": "11111111-1111-1111-1111-111111111111",
    "createdAt": "2026-03-21T10:00:00Z",
    "updatedAt": "2026-03-21T10:00:00Z"
  }
}
```

### 2) List Courses
GET /api/v1/courses

Query params (optional):
- page: number (default 1)
- limit: number (default 20, max 100)

Response (200):
```json
{
  "success": true,
  "message": "Courses fetched successfully",
  "data": {
    "meta": {
      "page": 1,
      "limit": 20,
      "totalRecords": 12,
      "totalPages": 1
    },
    "data": [
      {
        "courseId": "uuid-course1",
        "title": "TypeScript Fundamentals",
        "description": "Learn TS basics and best practices",
        "instructorId": "11111111-1111-1111-1111-111111111111",
        "createdAt": "2026-03-21T10:00:00Z",
        "updatedAt": "2026-03-21T10:00:00Z"
      }
    ]
  }
}
```

### 3) Get Course Details
GET /api/v1/courses/:id

Response (200):
```json
{
  "success": true,
  "message": "Course fetched successfully",
  "data": {
    "courseId": "uuid-course1",
    "title": "TypeScript Fundamentals",
    "description": "Learn TS basics and best practices",
    "instructorId": "11111111-1111-1111-1111-111111111111",
    "createdAt": "2026-03-21T10:00:00Z",
    "updatedAt": "2026-03-21T10:00:00Z"
  }
}
```

### 4) Enroll User in Course
POST /api/v1/courses/:id/enroll

Request body:
```json
{
  "userId": "22222222-2222-2222-2222-222222222222"
}
```

Response (201):
```json
{
  "success": true,
  "message": "User enrolled successfully",
  "data": {
    "enrollmentId": "uuid-enroll1",
    "courseId": "uuid-course1",
    "userId": "22222222-2222-2222-2222-222222222222",
    "status": "ENROLLED",
    "progress": 0,
    "completedAt": null,
    "createdAt": "2026-03-21T11:00:00Z",
    "updatedAt": "2026-03-21T11:00:00Z",
    "course": {
      "courseId": "uuid-course1",
      "title": "TypeScript Fundamentals"
    }
  }
}
```

### 5) List All Enrollments
GET /api/v1/courses/enrollments

Query params (optional):
- page: number (default 1)
- limit: number (default 20, max 100)
- userId: UUID
- courseId: UUID
- status: ENROLLED | COMPLETED | DROPPED

Response (200):
```json
{
  "success": true,
  "message": "Enrollments fetched successfully",
  "data": {
    "meta": {
      "page": 1,
      "limit": 20,
      "totalRecords": 1,
      "totalPages": 1
    },
    "data": [
      {
        "enrollmentId": "uuid-enroll1",
        "courseId": "uuid-course1",
        "userId": "22222222-2222-2222-2222-222222222222",
        "status": "ENROLLED",
        "progress": 0,
        "completedAt": null,
        "createdAt": "2026-03-21T11:00:00Z",
        "updatedAt": "2026-03-21T11:00:00Z",
        "course": {
          "courseId": "uuid-course1",
          "title": "TypeScript Fundamentals"
        }
      }
    ]
  }
}
```

### Notes
- Uses tables: courses, course_enrollments
- Duplicate enrollments for the same user and course are rejected
- Input validation uses Zod schemas

