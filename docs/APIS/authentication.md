## Authentication Module
Basic Route: /api/v1/auth
1️⃣ Register User
POST /register
Request Body:
{
  "name": "John Doe",
  "email": "john@company.com",
  "password": "Password123!",
  "roleId": "uuid-role",
  "departmentId": "uuid-department",
  "region": "US",
  "salary": 5000
}
Validation Rules (Zod):
•	name → string, min 3 chars
•	email → valid email
•	password → min 8 chars, must include uppercase, lowercase, number, symbol
•	roleId, departmentId → valid UUID
•	salary → number ≥ 0
•	region → ISO 3166-1 alpha-2
Response Body (201 Created):
{
  "userId": "uuid-user",
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "expiresIn": 900
}

2️⃣ Login User
POST /login
Request Body:
{
  "email": "john@company.com",
  "password": "Password123!"
}
Response Body (200 OK):
{
  "userId": "uuid-user",
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "expiresIn": 900,
  "role": "EMPLOYEE",
  "departmentId": "uuid-department",
  "name": "John Doe"
}
Notes:
•	expiresIn → seconds until access token expires (e.g., 15 min = 900 sec)
•	Role is important for role-based access middleware

3️⃣ Refresh Token
POST /refresh-token
Request Body:
{
  "refreshToken": "jwt-refresh-token"
}
Response Body (200 OK):
{
  "accessToken": "new-jwt-access-token",
  "refreshToken": "new-jwt-refresh-token",
  "expiresIn": 900
}
Notes:
•	Both tokens can be rotated for security
•	Old refresh token should be invalidated in DB

4️⃣ Logout
POST /logout
Request Body:
{
  "refreshToken": "jwt-refresh-token"
}
Response Body (200 OK):
{
  "message": "User logged out successfully"
}
Notes:
•	Deletes refresh token from DB
•	Access token will expire naturally

5️⃣ Get Profile (Authenticated)
GET /me
Headers:
Authorization: Bearer <accessToken>
Response Body (200 OK):
{
  "userId": "uuid-user",
  "name": "John Doe",
  "email": "john@company.com",
  "role": "EMPLOYEE",
  "departmentId": "uuid-department",
  "region": "US",
  "salary": 5000,
  "createdAt": "2026-03-07T12:00:00Z",
  "updatedAt": "2026-03-07T12:30:00Z"
}

6️⃣ Change Password (Authenticated)
POST /change-password
Headers:
Authorization: Bearer <accessToken>
Request Body:
{
  "oldPassword": "Password123!",
  "newPassword": "NewPassword456!"
}
Response Body (200 OK):
{
  "message": "Password changed successfully"
}

7️⃣ Forgot Password
Using SendGrid
POST /forgot-password
Request Body:
{
  "email": "john@company.com"
}
Response Body (200 OK):
{
  "message": "OTP has been sent to your email"
}

8️⃣ Reset Password
POST /reset-password
Request Body:
{
  "resetToken": "uuid-reset-token",
  "newPassword": "NewPassword456!"
}
Response Body (200 OK):
{
  "message": "Password reset successfully"
}

Notes on Implementation
1.	Password Storage:
Use bcrypt with saltRounds = 12+.
2.	JWT Tokens:
o	Access Token → 15 minutes
o	Refresh Token → 7 days
o	Include userId and role in payload.
3.	Role-Based Access:
o	SUPER_ADMIN → Full access
o	ADMIN → Department-level access
o	MANAGER → Team-level access
o	EMPLOYEE → Self only
4.	Input Validation:
o	Use Zod for schema validation in all endpoints.
o	Reject invalid emails, weak passwords, or missing fields.
5.	Security:
o	Rate-limit all endpoints (e.g., /login max 5 attempts per minute)
o	Use HTTPS and secure cookies for refresh token storage.

