# PS02 — Intelligent Ride Matching & Dynamic Driver Allocation

<<<<<<< HEAD
A working ride-hailing prototype for Bengaluru: passengers book on a live map, the dispatcher ranks
and assigns the best nearby driver, the ride is tracked in real time, and five advanced features run
on top — demand forecasting, zone/surge intelligence, ride pooling, explainable allocation and
automatic reassignment — plus a seeded simulator and an evaluation dashboard.

- **Passenger** — click-to-set pickup/drop, nearby drivers, fare + surge estimate, live ride stepper,
  "why this driver", history.
- **Driver** — online/offline, 15 s offer countdown with accept/reject, stage buttons, pooled stop
  order, earnings.
- **Admin** — live fleet, demand heatmap, zones & surge, allocation explorer, pooling planner,
  simulator + chaos, evaluation, ride/driver management and an event log.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18 + Vite + TypeScript + Tailwind + react-leaflet + Recharts |
| Backend | Node 20 + Express + Socket.IO + TypeScript (`tsx` in dev) |
| Database | PostgreSQL + Prisma |
| Routing / ETA | OSRM `/route` + `/table`, Haversine × 1.3 fallback, 3 s timeout, in-memory cache |
| ML | Python 3 + pandas + scikit-learn (`GradientBoostingRegressor`), run offline |
| Validation / auth | zod, JWT + bcrypt, roles `PASSENGER / DRIVER / ADMIN` |
| Tests | vitest (pure functions) |

## Layout

```
frontend/   React app (routes: /, /login, /passenger, /driver, /admin)
backend/    Express + Socket.IO + Prisma
  src/routes       REST routers (registered in src/app.ts)
  src/services     business logic (dispatch, matching, pooling, zones, simulator, evaluation, ...)
  src/socket       Socket.IO handlers
  prisma/          schema + demo seed
shared/     types, enums, socket events, API DTOs, global config — imported by both sides
ml/         offline demand generation + training
docs/       assumptions
scripts/    setup helper
```

Frontend and backend never import each other; everything shared lives in `shared/`.

## Quick start

Needs Node 20+ and PostgreSQL (local Docker, Neon or Supabase).

```bash
npm install
npm run setup        # creates .env from .env.example if missing
npm run db:up        # local PostgreSQL via docker compose (or set DATABASE_URL yourself)
npm run db:init      # prisma generate + push schema + seed demo users
npm run dev          # backend :4000 + frontend :5173
```

Open http://localhost:5173. Health: http://localhost:4000/api/health

**Demo logins** (password `password123`):

| Role | Email |
| --- | --- |
| Passenger | `passenger@demo.com` |
| Driver | `driver@demo.com` |
| Admin | `admin@demo.com` |

The simulator creates `sim-driver-N@demo.com` / `sim-passenger-N@demo.com` accounts as needed.
=======
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
>>>>>>> 2c9d961896379c7a559888f959bc1f6d16bab32a

## Commands

| Command | What it does |
| --- | --- |
<<<<<<< HEAD
| `npm run dev` | Backend + frontend together |
| `npm run dev:backend` / `dev:frontend` | One side only |
| `npm run typecheck` | TypeScript check for shared, backend, frontend |
| `npm test` | Backend vitest suite (pure functions + HTTP health/404) |
| `npm run build` | Typecheck all packages + production frontend build |
| `npm run db:up` / `db:down` | Start / stop local PostgreSQL |
| `npm run db:init` | generate client + push schema + seed demo users |
| `npm run db:seed` | Re-seed demo users |
| `npm run db:migrate` | Create a Prisma migration (`db:push` is enough for a demo) |

Tests do **not** require a database: the only DB-touching test is the health endpoint, which reports
`database: false` when PostgreSQL is unavailable instead of failing.

## Demand forecasting (offline ML)

The ML step is separate from the Node app and only needs a reachable `DATABASE_URL`.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r ml/requirements.txt

python ml/generate_data.py          # 60 days x 20x20 zones x 24 h -> DemandHistory
python ml/train.py                  # date split, metrics -> ml/model_metrics.json,
                                    # 24 h forecast -> DemandForecast
```

`generate_data.py` refuses to overwrite existing history unless you pass `--reset`, and only ever
touches `DemandHistory`. `train.py` only writes `DemandForecast` plus the local metrics file.
The admin **Demand intelligence** tab then compares predicted vs observed demand and shows the
top-zone chart and repositioning recommendations.

If the forecast tables are empty, the admin heatmap falls back to live observed demand and says so.

## How the features fit together

- **Matching / allocation** — `rankDrivers` scores AVAILABLE drivers within 5 km:
  `0.45·eta + 0.20·workload + 0.15·(1−acceptance) − 0.20·idle` (lower wins), min-max normalised per
  candidate. The full breakdown is persisted on `Ride.allocationScores` and shown as "Why driver X"
  with the next two alternates. `rankNearestOnly` is the evaluation baseline.
- **Reassignment** — reject, 15 s no-response, driver cancel, or a delay where the actual ETA exceeds
  the promised ETA by 30 %. The failed driver is excluded and the next-ranked driver is offered; if
  none accept the ride returns to `REQUESTED` and retries (3 × 10 s) before notifying the passenger.
- **Zones / surge** — 20 × 20 grid (`r{row}c{col}`, row 0 = north). Demand is the trailing 15-minute
  request count scaled to an hourly rate and blended 50/50 with the ML forecast when present; supply
  is AVAILABLE drivers in the zone. Surge is
  `clamp(1 + 0.5·(demand/supply − 1), 1.0, 2.5)` with a supply floor of 1.
- **Pooling** — every 30 s, pending rides with pickups ≤ 1.5 km and drops ≤ 2 km are grouped (max 3
  riders). Valid stop orders keep pickup before drop and every rider within a 30 % detour; pooled
  fare = solo × 0.75.
- **Simulator / evaluation** — mulberry32 seeded fleet of 25 drivers moving at 8× speed with
  automatic requests, responses and ride lifecycles. Evaluation replays the same seeded request
  stream under NEAREST and SMART and persists two `SimRun` rows.

All tunable values (city bounds, fare, weights, pooling, surge, simulator) live in
`shared/src/config.ts`; secrets and URLs live in `.env`.

## Docs

- `AGENTS.md` — project spec and phase plan
- `docs/ASSUMPTIONS.md` — decisions taken where the spec left room

## Known limitations

- No payments, OTP/phone auth, chat, multi-city support or admin user management.
- Admin **Settings** is read-only: it shows the account, `/api/health` and the compiled config. There
  is no API to edit users or runtime settings.
- The ML scripts are offline only; the running API never trains a model.
- Driver earnings in the UI assume a 20 % platform commission.

=======
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

>>>>>>> 2c9d961896379c7a559888f959bc1f6d16bab32a
## Troubleshooting

| Problem | Fix |
| --- | --- |
<<<<<<< HEAD
| Frontend cannot reach the API | Backend not running (`npm run dev:backend`); check port 4000 |
| `db:push` cannot connect | Start PostgreSQL (`npm run db:up`) and check `DATABASE_URL` in `.env` |
| Admin demand heatmap says no forecast | Run `python ml/generate_data.py` then `python ml/train.py` |
| Port already in use | Change `PORT` in `.env` and the Vite proxy target |
=======
| Frontend says "Backend offline" | Backend not running: `npm run dev:backend`, check port 4000 is free |
| `db:push` can't connect | Is Docker running? `npm run db:up`; check `DATABASE_URL` in `.env` |
| Port already in use | Change `PORT` in `.env` and the proxy target in `frontend/vite.config.ts` |
>>>>>>> 2c9d961896379c7a559888f959bc1f6d16bab32a
| Prisma client errors after pulling | `npm run db:generate` |
