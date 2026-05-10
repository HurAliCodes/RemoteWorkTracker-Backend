import express from "express";
import fs from "fs";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import rolesRouter from "./modules/roles/role.routes";
import organizationRouter from "./modules/organizations/organization.routes";
import departmentRouter from "./modules/departments/department.routes";
import projectRouter from "./modules/projects/project.routes";
import tasksRouter from "./modules/tasks/tasks.routes";
import notificationRouter from "./modules/notifications/notification.routes";
import goalRouter from "./modules/goals/goal.routes";
import learningRouter from "./modules/learning/learning.routes";
import userRouter from "./modules/users/user.routes";
import wellnessRouter from "./modules/wellness/wellness.routes";
import agentRouter from "./modules/agent/agent.routes";
import payrollRouter from "./modules/payroll/payroll.routes";
import attendanceRouter from "./modules/attendance/attendance.routes";
import telemetryRouter from "./modules/telemetry/telemetry.routes";
import dashboardRouter from "./modules/dashboard/dashboard.routes";
import analyticsRouter from "./modules/analytics/analytics.routes";
import aiRouter from "./modules/ai/ai.routes";
import { ENV } from "./config/env";
import { getCorsOptions } from "./config/cors";
import { apiRateLimiter } from "./middleware/rateLimit.middleware";
import { notFoundHandler } from "./middleware/notFoundHandler";
import { errorMiddleware } from "./middleware/error.middleware";

const app = express();

if (ENV.TRUST_PROXY) {
  app.set("trust proxy", 1);
}

// Swagger UI loads assets + inline JS from CDN; Helmet CSP blocks it by default.
// If you want stricter CSP later, we can add a per-route CSP just for /api and allowlist Swagger CDNs for /docs.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(getCorsOptions()));
app.use(express.json({ limit: '1mb' }));

// Swagger UI + OpenAPI spec (static files).
// In a serverless deployment the working directory layout differs from local
// dev, so probe a few candidate locations and only mount /docs if we find
// the swagger folder. This avoids 500s when the asset isn't bundled.
//
// Resolution notes:
// - ts-node / src: __dirname is .../src -> ../public/swagger
// - compiled to dist/src: __dirname is .../dist/src -> ../../public/swagger
// - cwd() often backend root when started from package dir -> public/swagger
// - monorepo: cwd may be repo root -> backend/public/swagger
const swaggerCandidates = [
  path.resolve(__dirname, "../public/swagger"),
  path.resolve(process.cwd(), "public/swagger"),
  path.resolve(__dirname, "../../public/swagger"),
  path.resolve(process.cwd(), "backend/public/swagger"),
];
const swaggerDir = swaggerCandidates.find((p) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
});
if (swaggerDir) {
  // Mount the same static folder under two paths so both
  // /docs and /swagger work in the deployed environment.
  app.use("/docs", express.static(swaggerDir));
  app.use("/swagger", express.static(swaggerDir));
}

app.use("/api", apiRateLimiter);

app.use("/api/v1/roles", rolesRouter);
app.use("/api/v1/organizations", organizationRouter);
app.use("/api/v1/departments", departmentRouter);
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/tasks", tasksRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/goals", goalRouter);
app.use("/api/v1/courses", learningRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/wellness", wellnessRouter);
app.use("/api/v1/agent", agentRouter);
app.use("/api/v1/payroll", payrollRouter);
app.use("/api/v1/attendance", attendanceRouter);
app.use("/api/v1/telemetry", telemetryRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/analytics", analyticsRouter);
app.use("/api/v1/ai", aiRouter);
app.get("/", (req, res) => {
  const payload = {
    status: "ok",
    message: "API is running",
    documentationUrl: "/docs/",
    openApiSpecUrl: "/docs/openapi.json",
    alternateDocumentationUrl: "/swagger/",
    healthUrl: "/health",
  };

  if (req.accepts("html")) {
    res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Remote Work Tracker API</title>
</head>
<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:2rem;line-height:1.5">
<h1 style="margin-top:0">Remote Work Tracker API</h1>
<p>The service is running.</p>
<ul>
  <li><a href="/docs/">Swagger UI</a> — interactive API docs</li>
  <li><a href="/docs/openapi.json">OpenAPI document</a> (JSON)</li>
  <li><a href="/health">Health check</a></li>
</ul>
<p style="color:#555;font-size:0.9rem">Refresh the spec locally with <code>npm run openapi:generate</code> from the backend directory.</p>
</body>
</html>`);
    return;
  }

  res.json(payload);
});

// Lightweight health-check that does NOT touch the database. Useful for
// confirming the Vercel function itself is alive (i.e. the runtime
// successfully imported the app without crashing).
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    env: ENV.NODE_ENV,
    uptime: process.uptime(),
  });
});

app.use(notFoundHandler);
app.use(errorMiddleware);

export default app;
