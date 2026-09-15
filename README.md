# Personal Sprint & Task Manager

A single-user web application for tracking daily office work against sprints.

## Tech Stack
- **Backend:** Go (REST API with `go-chi/chi/v5` and `modernc.org/sqlite` pure-Go driver)
- **Frontend:** React SPA (Vite + TypeScript + `@nivo` charts + `html-to-image`)
- **Database:** SQLite with WAL mode, foreign keys, and safe transaction snapshots
- **Media Storage:** Stored in persistent volume, served directly by the backend
- **Deployment:** Single container running both Nginx (serving frontend + reverse proxy) and Go API backend

---

## Quick Start (Docker)

To build and launch the application using Docker Compose:

```bash
docker compose up --build -d
```

Open your browser at **[http://localhost:8420](http://localhost:8420)**.

The database and media uploads persist across restarts in the `personal_task_manager_data` volume.

To view logs:
```bash
docker compose logs -f
```

To stop:
```bash
docker compose down
```

---

## Local Development (Without Docker)

### 1. Run Backend Server
```bash
cd backend
go run ./cmd/server
# Listens on http://localhost:8421 (SQLite stored at backend/data/app.db)
```

### 2. Run Frontend Dev Server
```bash
cd frontend
npm install
npm run dev
# Vite dev server runs at http://localhost:8420 with API proxy to localhost:8421
```

---

## Features & Screens

1. **Today (`/`):** Carry-over logic naturally brings forward unfinished tasks (`status != 'done' AND is_deferred = 0 AND assigned_date <= today`). Quick inline status toggles, blocker comments, subtask management.
2. **All Tasks (`/tasks`):** Filter by status, sprint, ad-hoc, tech task, or text search. Detailed inspection with comments and attachments.
3. **Sprint Setup (`/sprints`):** Dual-mode sprint planning (start date + duration OR start date + end date), plus Jira-style card groupings.
4. **Backlog / Do Later (`/backlog`):** Park deferred tasks out of the daily rollover until you assign them to an active date.
5. **Reports & Charts (`/reports`):** Sprint burndown line chart, daily completions bar chart, status breakdown donut, velocity metrics, and full-year activity heatmap.
6. **Export (`/export`):** Select tasks and generate high-resolution PNG images rendered client-side for sharing.
7. **Backup & Restore (`/backup`):** One-click transactional `.zip` export and archive restoration.
