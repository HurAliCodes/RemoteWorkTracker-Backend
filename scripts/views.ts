import { withDatabase } from './utils/db';
const sql = `
-- 1. View: active_employees
CREATE OR REPLACE VIEW active_employees AS
SELECT userId, name, email, roleId, departmentId, region, salary
FROM users
WHERE roleId IS NOT NULL AND departmentId IS NOT NULL;

-- 2. View: monthly_attendance_summary
CREATE OR REPLACE VIEW monthly_attendance_summary AS
SELECT 
  userId,
  DATE_TRUNC('month', checkIn) AS month,
  COUNT(sessionId) AS days_present,
  SUM(workedHours) AS total_hours
FROM attendance
GROUP BY userId, DATE_TRUNC('month', checkIn);

-- 3. View: project_task_status
CREATE OR REPLACE VIEW project_task_status AS
SELECT 
  p.projectId,
  p.name AS project_name,
  t.taskId,
  t.title AS task_title,
  t.status AS task_status,
  t.assignedTo
FROM projects p
JOIN tasks t ON p.projectId = t.projectId;

-- 4. View: employee_payroll_summary
CREATE OR REPLACE VIEW employee_payroll_summary AS
SELECT 
  u.userId,
  u.name,
  p.month,
  p.basicSalary,
  p.overtime,
  p.bonus,
  p.deductions,
  p.netPay
FROM users u
JOIN payroll p ON u.userId = p.userId;

-- 5. View: department_performance
CREATE OR REPLACE VIEW department_performance AS
SELECT 
  d.departmentId,
  d.name AS department_name,
  AVG(pr.overallScore) AS avg_performance_score,
  COUNT(pr.reviewId) AS total_reviews
FROM departments d
JOIN users u ON d.departmentId = u.departmentId
JOIN performance_reviews pr ON u.userId = pr.userId
GROUP BY d.departmentId, d.name;
`;

async function runViewsScript() {
  await withDatabase(async (client) => {
    await client.query(sql);
    console.log('Views created/updated successfully.');
  });
}

runViewsScript().catch((err) => {
  console.error('Error running views creation SQL:', err);
});
