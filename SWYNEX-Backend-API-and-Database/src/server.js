import express from "express";
import cors from "cors";
import Database from "better-sqlite3";

const app = express();
const PORT = process.env.PORT || 5000;
const db = new Database("tasks.db");

db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
    description TEXT NOT NULL DEFAULT '',
    dueDate TEXT,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed')),
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`);

app.use(cors());
app.use(express.json({ limit: "100kb" }));

const priorities = new Set(["low", "medium", "high"]);
const statuses = new Set(["pending", "completed"]);
const byId = (id) => db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);

function validate(body, partial = false) {
  const errors = [];
  if (!partial || Object.hasOwn(body, "title")) {
    if (typeof body.title !== "string" || !body.title.trim()) errors.push("title is required");
    else if (body.title.trim().length > 120) errors.push("title must be 120 characters or fewer");
  }
  if (Object.hasOwn(body, "description") && typeof body.description !== "string") errors.push("description must be a string");
  if (Object.hasOwn(body, "priority") && !priorities.has(body.priority)) errors.push("priority must be low, medium, or high");
  if (Object.hasOwn(body, "status") && !statuses.has(body.status)) errors.push("status must be pending or completed");
  if (Object.hasOwn(body, "dueDate") && body.dueDate !== null && body.dueDate !== "") {
    const d = body.dueDate;
    if (typeof d !== "string" || !/^\\d{4}-\\d{2}-\\d{2}$/.test(d)) errors.push("dueDate must use YYYY-MM-DD format or be null");
    else {
      const parsed = new Date(`${d}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== d) errors.push("dueDate must be a valid calendar date");
    }
  }
  return errors;
}

app.get("/api/health", (_req, res) => res.json({ status: "ok", database: "connected" }));

app.get("/api/tasks", (req, res) => {
  const { status, priority } = req.query;
  if (status !== undefined && !statuses.has(status)) return res.status(400).json({ error: "Invalid status filter" });
  if (priority !== undefined && !priorities.has(priority)) return res.status(400).json({ error: "Invalid priority filter" });
  const conditions = [], params = [];
  if (status) { conditions.push("status = ?"); params.push(status); }
  if (priority) { conditions.push("priority = ?"); params.push(priority); }
  const sql = "SELECT * FROM tasks" + (conditions.length ? " WHERE " + conditions.join(" AND ") : "") + " ORDER BY id DESC";
  res.json(db.prepare(sql).all(...params));
});

app.get("/api/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "id must be a positive integer" });
  const task = byId(id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json(task);
});

app.post("/api/tasks", (req, res) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) return res.status(400).json({ error: "Body must be a JSON object" });
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ errors });
  const now = new Date().toISOString();
  const result = db.prepare(`INSERT INTO tasks (title, description, dueDate, priority, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(req.body.title.trim(), req.body.description?.trim() ?? "", req.body.dueDate || null, req.body.priority ?? "medium", req.body.status ?? "pending", now, now);
  res.status(201).json(byId(Number(result.lastInsertRowid)));
});

app.put("/api/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "id must be a positive integer" });
  const old = byId(id);
  if (!old) return res.status(404).json({ error: "Task not found" });
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) return res.status(400).json({ error: "Body must be a JSON object" });
  const errors = validate(req.body, true);
  if (errors.length) return res.status(400).json({ errors });
  const next = {
    title: req.body.title === undefined ? old.title : req.body.title.trim(),
    description: req.body.description === undefined ? old.description : req.body.description.trim(),
    dueDate: req.body.dueDate === undefined ? old.dueDate : (req.body.dueDate || null),
    priority: req.body.priority ?? old.priority,
    status: req.body.status ?? old.status,
    updatedAt: new Date().toISOString()
  };
  db.prepare("UPDATE tasks SET title=?, description=?, dueDate=?, priority=?, status=?, updatedAt=? WHERE id=?")
    .run(next.title, next.description, next.dueDate, next.priority, next.status, next.updatedAt, id);
  res.json(byId(id));
});

app.patch("/api/tasks/:id/status", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "id must be a positive integer" });
  if (!byId(id)) return res.status(404).json({ error: "Task not found" });
  if (!req.body || !statuses.has(req.body.status)) return res.status(400).json({ error: "status must be pending or completed" });
  db.prepare("UPDATE tasks SET status=?, updatedAt=? WHERE id=?").run(req.body.status, new Date().toISOString(), id);
  res.json(byId(id));
});

app.delete("/api/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "id must be a positive integer" });
  const result = db.prepare("DELETE FROM tasks WHERE id=?").run(id);
  if (!result.changes) return res.status(404).json({ error: "Task not found" });
  res.json({ message: "Task deleted successfully", id });
});

app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && "body" in err) return res.status(400).json({ error: "Invalid JSON body" });
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => console.log(`Student Task Manager API running at http://localhost:${PORT}`));
