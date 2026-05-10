## Notifications Module Backend Planning (REST + FCM + WebSocket)
1️⃣ Architecture
src/
│
├── config/
│   ├── db.js
│   ├── env.js
│   ├── firebase.js          # Firebase admin initialization
│
├── modules/
│   ├── notifications/
│   │   ├── notification.controller.js
│   │   ├── notification.service.js
│   │   ├── notification.routes.js
│   │   ├── notification.validation.js
│
├── middleware/
│   ├── auth.middleware.js
│   ├── role.middleware.js
│
├── services/
│   ├── socket.service.js       # WebSocket handling
│   ├── notification.service.js # Logic for REST + FCM + WebSocket
│
├── utils/
│
├── routes/
│
├── controllers/
│
└── app.js

2️⃣ Technology Stack
Component	Technology
API Framework	Express.js
Real-Time	Socket.IO
Push Notifications	Firebase Cloud Messaging (FCM)
Database	PostgreSQL
Auth	JWT + Refresh Token
Validation	Zod / Joi
Logging	Winston

3️⃣ Database Design
Table: notifications
Column	Type	Notes
id	UUID	Primary Key
user_id	UUID	FK → users.id
title	VARCHAR(255)	Notification title
message	TEXT	Notification content
type	VARCHAR(50)	TASK, PAYROLL, GOAL, COMPLIANCE, WELLNESS
status	VARCHAR(20)	UNREAD / READ
created_at	TIMESTAMP	Default now()
read_at	TIMESTAMP	Nullable
fcm_sent	BOOLEAN	Default false
delivered	BOOLEAN	via WebSocket
Indexes:
•	user_id → for quick retrieval of user notifications
•	status → for filtering UNREAD notifications

4️⃣ Core Services
A) notification.service.js
Handles:
1.	Creating notifications in DB
2.	Sending push via FCM
3.	Broadcasting via Socket.IO
4.	Marking notifications as read
async function createNotification(userId, title, message, type) {
  const notif = await db.insert('notifications', { userId, title, message, type });
  // send FCM push
  await sendFCM(userId, title, message);
  // broadcast via WebSocket
  socketService.emitToUser(userId, 'newNotification', notif);
  return notif;
}

async function markAsRead(notificationId) {
  const notif = await db.update('notifications', { status: 'READ', read_at: new Date() }, { id: notificationId });
  return notif;
}

B) firebase.js
const admin = require('firebase-admin');
const serviceAccount = require('../config/firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;

C) socket.service.js
let io;

function init(server) {
  io = require('socket.io')(server, { cors: { origin: '*' } });
  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    socket.join(userId); // join room by userId
    console.log(`User ${userId} connected to WebSocket`);
  });
}

function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(userId).emit(event, payload);
}

module.exports = { init, emitToUser };

5️⃣ REST API Endpoints
Method	Route	Role Access	Description
GET	/notifications	All	Get all notifications (filter by user, status)
PATCH	/notifications/:id/read	All	Mark notification as read
POST	/notifications/send	Admin/Super Admin	Send notification manually

A) Get Notifications
GET /notifications
Query Parameters (optional):
Parameter	Type	Description
userId	string	Filter by employee UUID (Admins can view all)
status	string	UNREAD / READ
page	number	Pagination page (default 1)
limit	number	Number of records per page (default 20)
Response (200 OK):
{
  "meta": { "page": 1, "limit": 20, "totalRecords": 12, "totalPages": 1 },
  "data": [
    {
      "notificationId": "uuid-notif1",
      "userId": "uuid-user",
      "title": "Task Deadline Approaching",
      "message": "Your task 'Build login screen' is due in 2 days.",
      "status": "UNREAD",
      "type": "TASK",
      "createdAt": "2026-03-07T09:00:00Z"
    }
  ]
}

B) Mark Notification as Read
PATCH /notifications/:id/read
Request Body: (optional)
{}
Response (200 OK):
{
  "notificationId": "uuid-notif1",
  "status": "READ",
  "readAt": "2026-03-07T13:00:00Z"
}

C) Send Notification (Admin / SUPER_ADMIN)
POST /notifications/send
Request Body:
{
  "userId": "uuid-user",
  "title": "Task Deadline Approaching",
  "message": "Your task 'Build login screen' is due in 2 days",
  "type": "TASK"
}
Response (201 Created):
{
  "notificationId": "uuid-notif",
  "userId": "uuid-user",
  "title": "Task Deadline Approaching",
  "message": "Your task 'Build login screen' is due in 2 days",
  "type": "TASK",
  "status": "UNREAD",
  "createdAt": "2026-03-07T12:00:00Z"
}

6️⃣ Real-Time Flow
1.	Backend creates a notification → stores in DB
2.	FCM push → to mobile devices (offline/foreground/background)
3.	WebSocket broadcast → to active web/mobile sessions
4.	REST API → used for fetching notification history

7️⃣ Scheduled Jobs (Optional)
•	Daily task deadline reminders
•	Weekly summary notifications
•	Burnout alerts based on wellness logs
const cron = require('node-cron');
cron.schedule('0 8 * * *', async () => {
  await notificationService.sendDailyTaskSummary();
});

Advantages of This Design:
•	Works for mobile + web clients
•	Real-time via WebSocket
•	Offline support via FCM
•	REST APIs provide history and analytics
•	Fully role-based and scalable

