# PS02 — Intelligent Ride Matching & Dynamic Driver Allocation

RideOps is a Bengaluru ride-hailing prototype. Passengers book on a live map, the dispatcher ranks
and assigns nearby drivers, and rides are tracked in real time. The system also includes demand
forecasting, zone/surge intelligence, pooling, explainable allocation, reassignment, a seeded
simulator and an evaluation dashboard.

- **Passenger:** map-based pickup/drop selection, nearby drivers, fare and surge estimate, live ride
  progress, allocation explanation and ride history.
- **Driver:** availability, timed ride offers, ride progress, pooled stop order and trip history.
- **Admin:** live fleet, demand heatmap, zones and surge, allocation, pooling, simulation, evaluation,
  ride/driver management and event log.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18, Vite, TypeScript, Tailwind, react-leaflet, Recharts |
| Backend | Node 20+, Express, Socket.IO, TypeScript (`tsx`) |
| Database | PostgreSQL, Prisma |
| Routing / ETA | OSRM with Haversine fallback, timeout and in-memory cache |
| ML | Offline Python, pandas and scikit-learn |
| Validation / auth | zod, JWT, bcryptjs, roles `PASSENGER / DRIVER / ADMIN` |
| Tests | Vitest |

## Repository layout

The active npm workspaces are `frontend/`, `backend/` and `shared/`. The tracked `apps/web/` and
`apps/api/` directories are legacy scaffolds; they are not included in the root npm workspaces or
root start/build/test commands. They are retained for reference and are not the application entry
points.

```text
frontend/   React app, pages, components, hooks and API clients
backend/    Express routes, services, Socket.IO handlers and Prisma schema/seed
shared/     Types, enums, API DTOs, socket events and global configuration
ml/         Offline synthetic demand generation and model training
docs/       Project assumptions
```

Frontend and backend share code through `shared/`; neither imports directly from the other.

## Quick start

Requirements: Node.js 20+ and a reachable PostgreSQL instance. Set `DATABASE_URL` in the root
`.env` (copy `.env.example` if needed). To use the bundled local Docker database, run `npm run db:up`.
An already running native PostgreSQL server works as well; Docker is not required when `DATABASE_URL`
points to it.

```bash
npm install
npm run setup
npm run db:init
npm run dev
```

Open <http://localhost:5173>. Backend health check: <http://localhost:4000/api/health>.

Seeded demo accounts use password `password123`:

| Role | Email |
| --- | --- |
| Passenger | `passenger@demo.com` |
| Driver | `driver@demo.com` |
| Admin | `admin@demo.com` |

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run backend and frontend together |
| `npm run dev:backend` / `npm run dev:frontend` | Run one application |
| `npm run typecheck` | Typecheck shared, backend and frontend |
| `npm run build` | Typecheck workspaces and build the frontend |
| `npm test` | Run backend Vitest suite |
| `npm run db:up` / `npm run db:down` | Start / stop bundled PostgreSQL in Docker |
| `npm run db:init` | Generate Prisma client, sync schema, seed demo accounts |
| `npm run db:seed` | Re-seed demo accounts |
| `npm run db:migrate` | Create/apply a Prisma migration |

The health endpoint reports database reachability. Pure service and health-route tests can run
without a database; database-backed application features require PostgreSQL.

## Offline demand forecasting

The ML scripts run separately from Node and require a reachable `DATABASE_URL`.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r ml/requirements.txt
python ml/generate_data.py
python ml/train.py
```

`generate_data.py` writes synthetic records to `DemandHistory` and refuses to overwrite existing
history unless passed `--reset`. `train.py` evaluates a date-based holdout, writes metrics to
`ml/model_metrics.json`, and stores forecasts in `DemandForecast`.

## How the features fit together

- **Matching/allocation:** `rankDrivers` scores available drivers within 5 km; the score breakdown
  is persisted and exposed in the passenger view. `rankNearestOnly` is the evaluation baseline.
- **Reassignment:** rejection, timeout, driver cancellation or excessive delay can trigger another
  driver offer, with retries and passenger notification when no candidate is available.
- **Zones/surge:** a 20 × 20 grid blends recent requests with forecasts when available, compares
  demand with available supply, and calculates surge per zone.
- **Pooling:** nearby pending rides are evaluated for valid pickup/drop ordering and detour limits;
  pooled fare uses the configured discount.
- **Simulator/evaluation:** a seeded driver fleet generates requests and ride lifecycles; evaluation
  compares NEAREST and SMART strategies and stores metrics.

Tunable values live in `shared/src/config.ts`; secrets and service URLs belong in `.env`.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Frontend cannot reach the API | Start backend with `npm run dev:backend`; check port 4000 |
| Database connection fails | Check PostgreSQL is running and `DATABASE_URL` is correct |
| Admin heatmap has no forecast | Run `python ml/generate_data.py` then `python ml/train.py` |
| Port already in use | Adjust `PORT` in `.env` and the Vite proxy target |
| Prisma client errors after pulling | Run `npm run db:generate` |
