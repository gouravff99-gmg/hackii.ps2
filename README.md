# PS02 — Intelligent Ride Matching and Dynamic Driver Allocation

Working prototype for a ride-hailing platform: passengers request rides on a live map, the
system ranks and assigns the best nearby driver, tracks the full lifecycle in real time, and
ships five advanced features (demand forecasting, zone surge, pooling, explainable
allocation, automatic reassignment) plus a seeded simulator and an evaluation harness.

> **Status: Phase 0 — scaffold.** Web + API boot, shared types exist, Prisma schema defined.
> Feature work lands in later phases.

## Stack

React 18 + Vite + TypeScript + Tailwind · react-leaflet/OSM · Recharts ·
Node + Express + Socket.IO + TypeScript (`tsx`) · PostgreSQL + Prisma · zod · vitest ·
JWT + bcryptjs · Python (offline ML, Phase 4).

## Repository layout

```
apps/web        React SPA (login, passenger, driver, admin)
apps/api        Express + Socket.IO + Prisma
  prisma        schema.prisma, seed.ts
shared          types.ts enums.ts events.ts config.ts (single source of truth)
ml              offline forecasting scripts (Phase 4)
docker-compose.yml   local PostgreSQL 16
```

## Prerequisites

- Node.js 20+ (tested on 24)
- Docker (for local Postgres) or any PostgreSQL 14+ / Neon / Supabase URL
- Python 3.11+ (only for Phase 4 ML)

## Setup — 5 commands

```bash
npm install
cp .env.example .env          # Windows: copy .env.example .env
docker compose up -d          # local Postgres
npm run prisma:generate
npm run db:push && npm run seed
```

Then start everything:

```bash
npm run dev
```

- Web: http://localhost:5173
- API health: http://localhost:4000/api/health
- Demo logins: `passenger@demo`, `driver@demo`, `admin@demo` — password `password123`

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | API (`tsx watch`) + web (Vite) together |
| `npm run build` | Typecheck shared/api + production build web |
| `npm run typecheck` | Typecheck all workspaces |
| `npm test` | vitest (API workspace) |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to DB (fast local setup) |
| `npm run migrate` | Create/apply a Prisma migration |
| `npm run seed` | Seed demo users |

## Architecture (text)

```
Browser (React + Leaflet)
   │  REST /api        Socket.IO (ride:status, driver:location, …)
   ▼                      ▼
Express routes ──► services (geo, osrm, fare, surge, zones, allocation,
   │                matching, pooling, reassignment, forecast, rideStateMachine,
   │                simulator, evaluation)
   ├── Prisma ──► PostgreSQL
   └── OSRM / Nominatim (timeout + cache + Haversine fallback; app works offline)
```

## Docs

- `AGENTS.md` — full project spec (single source of truth)
- `ASSUMPTIONS.md` — decisions and scope notes

## Known limitations (Phase 0)

- Only a health endpoint and a landing page are wired; ride flows arrive in Phase 2.
- No automated tests beyond the shared-config smoke test yet.
- Local Postgres is provided through Docker Compose; a hosted DB works by changing `DATABASE_URL`.
