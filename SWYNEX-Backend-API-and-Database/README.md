# SWYNEX — Backend API and Database
Student Task Manager backend for Task 2.

## Stack
- Node.js + Express
- SQLite (`better-sqlite3`)
- JSON REST API

## Features
- Create, list, view, update, and delete tasks
- Change task status
- Filter tasks by status and priority
- Validate title, priority, status, and due date
- Save task records persistently in SQLite

## Run
Install Node.js LTS, then in this folder run:
```bash
npm install
npm run dev
```
API base URL: `http://localhost:5000`
The `tasks.db` database file is created automatically.

## Routes
- `GET /api/health`
- `GET /api/tasks` (optional `?status=pending&priority=high`)
- `GET /api/tasks/:id`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `PATCH /api/tasks/:id/status`
- `DELETE /api/tasks/:id`

## Example POST body
```json
{
  "title": "Complete database assignment",
  "description": "Finish ER diagram",
  "dueDate": "2026-10-25",
  "priority": "high"
}
```

## Validation
Title is required and limited to 120 characters. Priority must be `low`, `medium`, or `high`. Status must be `pending` or `completed`. Optional due dates must use a valid `YYYY-MM-DD` date. Invalid input returns HTTP 400; missing tasks return HTTP 404.

Do not upload `node_modules`, credentials, or `.env` files to GitHub.
