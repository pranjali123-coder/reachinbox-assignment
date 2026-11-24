# ReachInbox – Full-stack Email Job Scheduler

A production-style implementation of the ReachInbox hiring assignment using:
- Backend: Node.js + TypeScript + Express
- Queue: BullMQ + Redis (delayed jobs, no cron)
- Database: PostgreSQL + Prisma
- SMTP: Ethereal Email
- Search: Elasticsearch
- Queue dashboard: Bull Board
- Frontend: React + TypeScript + Vite + Tailwind CSS
- Auth: Google OAuth + JWT httpOnly cookie
- Slack: OAuth + live rate-limit notification

## Important
The assignment mentions a Figma URL, but the URL itself was not included in the material provided to me. The frontend therefore implements the required screens and a clean dashboard layout, but exact pixel matching requires the actual Figma link.

## Architecture
`POST /api/emails/schedule` stores one parent campaign and individual email records in PostgreSQL, then creates BullMQ delayed jobs with deterministic job IDs. Redis persists queue state. The worker consumes jobs at the scheduled time. The DB status is updated transactionally around the send operation and an idempotency check prevents a completed email from being sent again after a restart.

Hourly limits use Redis atomic counters keyed by `senderId:hourWindow`; counters are shared by all workers/instances. Per-email pacing uses a Redis Lua script to atomically reserve the next send slot for each sender. When the hourly limit is reached, the job is re-added with a future timestamp instead of being dropped.

Elasticsearch receives an index document after a scheduled/sent record is created or updated. Search is available through `GET /api/emails/search?q=...`.

## 1. Prerequisites
- Node.js 20+
- Docker + Docker Compose
- Google OAuth credentials
- Slack OAuth app credentials (optional for normal email scheduling, required for the Slack demo)
- Ethereal account

## 2. Start infrastructure
```bash
docker compose up -d postgres redis elasticsearch
```

## 3. Backend
```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

In another terminal:
```bash
cd backend
npm run worker
```

Bull Board is available at `http://localhost:4000/admin/queues`.

## 4. Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`.

## 5. Required environment variables
See `backend/.env.example` and `frontend/.env.example`.

Google redirect URI for local development:
`http://localhost:4000/api/auth/google/callback`

Slack redirect URI for local development:
`http://localhost:4000/api/slack/callback`

## Rate limiting / concurrency
Example configuration:
- `WORKER_CONCURRENCY=5`
- `MIN_DELAY_MS=2000`
- `MAX_EMAILS_PER_HOUR_PER_SENDER=200`

The values are configurable; they are not hardcoded in the worker.

## Restart behavior demo
1. Schedule an email for 30–60 seconds in the future.
2. Stop the backend and worker processes.
3. Start them again.
4. Redis still contains the delayed BullMQ job and PostgreSQL still contains the email record.
5. The worker picks up the job at the correct scheduled time.

## 1000+ simultaneous emails
Each email is an independent BullMQ job. Delayed jobs remain persisted in Redis. Worker concurrency controls processing parallelism while the Redis pacing and hourly counters protect the sender. If the hourly limit is exhausted, jobs are moved to a future window rather than permanently failed.

## Trade-offs
- Ethereal is intentionally used instead of a production SMTP provider.
- Elasticsearch indexing is asynchronous after the DB write; PostgreSQL remains the source of truth.
- Google/Slack credentials are environment configuration and cannot be committed.
- The local Docker setup is designed for development/demo rather than HA production deployment.
