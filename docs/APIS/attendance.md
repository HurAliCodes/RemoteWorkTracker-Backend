## ATTENDANCE MODULE

Base route:/api/v1/attendance
1️⃣ Check-In (Employee)
POST /attendance/check-in
Request Body:
{
  "latitude": 24.8607,
  "longitude": 67.0011,
  "ipAddress": "192.168.1.1",
  "deviceId": "uuid-device" // optional, for device-based check-in
}
Validation:
•	latitude → number, -90 to 90
•	longitude → number, -180 to 180
•	ipAddress → valid IPv4 or IPv6
Response (201 Created):
{
  "sessionId": "uuid-session",
  "userId": "uuid-user",
  "checkIn": "2026-03-07T09:00:00Z",
  "status": "CHECKED_IN",
  "location": {
    "latitude": 24.8607,
    "longitude": 67.0011,
    "ipAddress": "192.168.1.1"
  },
  "deviceId": "uuid-device" // optional, for device-based check-in
}

2️⃣ Check-Out (Employee)
POST /attendance/check-out
Request Body:
{
  "sessionId": "uuid-session",
  "deviceId": "uuid-device" // optional, for device-based check-out
}
Response (200 OK):
{
  "sessionId": "uuid-session",
  "userId": "uuid-user",
  "checkIn": "2026-03-07T09:00:00Z",
  "checkOut": "2026-03-07T18:00:00Z",
  "status": "COMPLETED",
  "workedHours": 9
}
Notes:
•	Calculates workedHours automatically
•	status → CHECKED_IN, COMPLETED

3️⃣ Get My Attendance (Employee)
GET /attendance/me
Query Parameters (optional):
Parameter	Type	Description
startDate	string	Filter logs from this date (YYYY-MM-DD)
endDate	string	Filter logs until this date (YYYY-MM-DD)
Response (200 OK):
{
  "userId": "uuid-user",
  "attendanceLogs": [
    {
      "sessionId": "uuid-session1",
      "checkIn": "2026-03-01T09:00:00Z",
      "checkOut": "2026-03-01T18:00:00Z",
      "status": "COMPLETED",
      "workedHours": 9,
      "location": {
        "latitude": 24.8607,
        "longitude": 67.0011,
        "ipAddress": "192.168.1.1"
      }
    },
    {
      "sessionId": "uuid-session2",
      "checkIn": "2026-03-02T09:15:00Z",
      "checkOut": "2026-03-02T17:45:00Z",
      "status": "COMPLETED",
      "workedHours": 8.5,
      "location": {
        "latitude": 24.8608,
        "longitude": 67.0012,
        "ipAddress": "192.168.1.2"
      }
    }
  ]
}

4️⃣ Get Attendance Logs (Admin / Manager)
GET /attendance
Query Parameters:
Parameter	Type	Description
userId	string	Filter by employee UUID
startDate	string	YYYY-MM-DD
endDate	string	YYYY-MM-DD
page	number	Pagination page (default 1)
limit	number	Number of records per page (default 20)
Response (200 OK):
{
  "meta": {
    "page": 1,
    "limit": 20,
    "totalRecords": 45,
    "totalPages": 3
  },
  "data": [
    {
      "sessionId": "uuid-session1",
      "userId": "uuid-user1",
      "name": "Ali Khan",
      "checkIn": "2026-03-01T09:00:00Z",
      "checkOut": "2026-03-01T18:00:00Z",
      "status": "COMPLETED",
      "workedHours": 9,
      "location": {
        "latitude": 24.8607,
        "longitude": 67.0011,
        "ipAddress": "192.168.1.1"
      }
    },
    {
      "sessionId": "uuid-session2",
      "userId": "uuid-user2",
      "name": "Sara Ahmed",
      "checkIn": "2026-03-01T09:30:00Z",
      "checkOut": "2026-03-01T18:15:00Z",
      "status": "COMPLETED",
      "workedHours": 8.75,
      "location": {
        "latitude": 24.8608,
        "longitude": 67.0012,
        "ipAddress": "192.168.1.2"
      }
    }
  ]
}

Notes:
1.	Role-Based Access:
Role	Access
EMPLOYEE	Can check-in/out and view own logs
MANAGER	Can view logs of their team
ADMIN	Can view logs of all employees
SUPER_ADMIN	Full access
2.	Validation:
•	Latitude, longitude, and IP address format
•	Session ID must exist when checking out
3.	Business Logic:
•	Prevent multiple check-ins for same day without checkout
•	Calculate worked hours automatically
•	Record location and IP for compliance and geo-fencing
4.	Error Responses:
{
  "error": "User already checked in for today"
}
{
  "error": "Session not found or already checked out"
}

## Device-based Attendance (NEW)

If your organization uses device-based attendance, you can include a `deviceId` in the check-in and check-out requests. This links the attendance record to a specific registered device.

### Check-In Example (with deviceId)
POST /attendance/check-in
Request Body:
{
  "latitude": 24.8607,
  "longitude": 67.0011,
  "ipAddress": "192.168.1.1",
  "deviceId": "uuid-device" // optional, for device-based check-in
}

### Check-Out Example (with deviceId)
POST /attendance/check-out
Request Body:
{
  "sessionId": "uuid-session",
  "deviceId": "uuid-device" // optional, for device-based check-out
}

### Notes:
- If `deviceId` is provided, the attendance record will be linked to the specified device.
- The response may include `deviceId` to indicate which device was used for the attendance event.
- Device registration is required before using device-based attendance (see Agent/Device Registration API).

