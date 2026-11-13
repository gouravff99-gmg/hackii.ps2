# PS02 — Intelligent Ride Matching & Dynamic Driver Allocation

A ride-hailing prototype: passengers request rides on a live map, the system ranks and assigns
the best nearby driver, tracks the ride in real time, and ships five advanced features
(demand forecasting, surge/zone intelligence, pooling, explainable allocation, automatic
reassignment) plus a seeded simulator and an evaluation dashboard.

> **Status: Phase 0 (scaffold).** Both servers start, shared types exist, DB schema is defined.
> Ride flows and features arrive in later phases (see `AGENTS.md`).

## Where things live

```
frontend/   React + Vite + Tailwind web app            -> http://localhost:5173
  src/pages        screens (Landing, Passenger, Driver, Admin)
  src/components   reusable UI pieces
  src/hooks        React hooks
  src/lib          api client + helpers
backend/    Node + Express + Socket.IO + Prisma API     -> http://localhost:4000
  src/routes       REST endpoints (/api/...)
  src/services     business logic (matching, fare, surge, pooling, ...)
  src/socket       real-time events
  src/config       environment loading
  prisma/          database schema + seed
shared/     types, enums, socket event names, global config (used by BOTH sides)
ml/         offline demand-forecast scripts (Phase 4)
docs/       decisions and assumptions
scripts/    helper scripts
```

Rule of thumb: **frontend and backend never import each other; they share code only via `shared/`.**

## Quick start

Needs Node 20+ and Docker (or any PostgreSQL / Neon / Supabase URL in `.env`).

```bash
npm install
npm run setup       # creates .env from .env.example
npm run db:up       # starts local PostgreSQL in Docker
npm run db:init     # prisma generate + create tables + demo users
npm run dev         # backend + frontend together
```

Open http://localhost:5173. Backend health check: http://localhost:4000/api/health

**Demo logins** (password `password123`): `passenger@demo.com`, `driver@demo.com`, `admin@demo.com`

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start backend and frontend together |
| `npm run dev:backend` / `dev:frontend` | Start just one side |
| `npm run build` | Typecheck everything + production build of the frontend |
| `npm run typecheck` | TypeScript check for all three packages |
| `npm test` | Backend unit tests (vitest) |
| `npm run db:up` / `db:down` | Start / stop local PostgreSQL |
| `npm run db:init` | generate client + push schema + seed |
| `npm run db:seed` | Re-seed demo users |
| `npm run db:migrate` | Create a Prisma migration (optional, `db:push` is enough for the hackathon) |

## Configuration

- Secrets and URLs: `.env` (copy of `.env.example`).
- City, fare, surge, pooling, allocation weights, simulator size/speed: `shared/src/config.ts`.
  Change the city there and everything (zones, map centre, simulator) follows.

## Docs

- `AGENTS.md` — full project spec and phase plan (what to build, in what order)
- `docs/ASSUMPTIONS.md` — decisions taken where the spec left room

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Frontend says "Backend offline" | Backend not running: `npm run dev:backend`, check port 4000 is free |
| `db:push` can't connect | Is Docker running? `npm run db:up`; check `DATABASE_URL` in `.env` |
| Port already in use | Change `PORT` in `.env` and the proxy target in `frontend/vite.config.ts` |
| Prisma client errors after pulling | `npm run db:generate` |
