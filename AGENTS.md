# AGENTS.md — PS02 Project Spec (single source of truth)

> Intelligent Ride Matching and Dynamic Driver Allocation System.
> Working, demo-able prototype. Speed + correctness + demo-ability over perfection.
> **Do not change the tech stack or scope below without an explicit instruction.**

## Working agreement

- Work in phases only. At the end of each phase: build + tests green, short summary, **stop**.
- One module at a time, files < 300 lines.
- Pure logic (fare, surge, scoring, pooling, ETA) lives in pure functions with vitest tests.
- Types first: shared types/enums/socket events/API shapes live in `/shared`; frontend and backend both import them.
- Never invent libraries/APIs. Unclear things → simplest reasonable assumption in `docs/ASSUMPTIONS.md`.
- No `// TODO implement` placeholders. Out-of-scope items are stated explicitly.
- Offline-tolerant externals: OSRM/Nominatim need timeout + cache + fallback.
- Prefer boring, simple solutions. No Redis/Kafka/microservices/GraphQL/Docker orchestration beyond the single local Postgres compose file.
- Commit-friendly: each phase prints a suggested `git commit -m "..."`.

## Tech stack (fixed)

| Layer | Choice |
| --- | --- |
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Map | react-leaflet + OpenStreetMap tiles (no API key) |
| Charts | Recharts |
| Backend | Node.js 20 + Express + Socket.IO, TypeScript (`tsx` for dev) |
| DB | PostgreSQL + Prisma (`DATABASE_URL`; docker-compose for local; Neon/Supabase compatible) |
| Routing/ETA | OSRM public API `/route` + `/table`; Haversine × 1.3 fallback; in-memory cache keyed by coords rounded to 4 dp; 3 s timeout |
| Geocoding | Nominatim (optional search, max 1 req/s); primary input is click-on-map |
| ML | Python 3 + pandas + scikit-learn (`GradientBoostingRegressor`), run **offline**; writes `demand_forecast` + `ml/model_metrics.json` |
| Validation | zod |
| Tests | vitest (pure functions) |
| Auth | JWT (`jsonwebtoken`) + bcrypt, roles PASSENGER / DRIVER / ADMIN |

## Monorepo layout

```
/frontend        React app (routes: /login, /passenger, /driver, /admin)
  src/pages        one file per screen (Landing, Passenger, Driver, Admin, Login)
  src/components   reusable UI pieces (maps, cards, badges, toasts)
  src/hooks        React hooks (useSocket, useAuth, ...)
  src/lib          api client, formatters, helpers
/backend         Express + Socket.IO + Prisma
  src/config       env.ts (loads root .env)
  src/routes       health.ts auth.ts rides.ts drivers.ts admin.ts
  src/services     geo.ts osrm.ts fare.ts surge.ts zones.ts allocation.ts
                   matching.ts pooling.ts reassignment.ts forecast.ts
                   rideStateMachine.ts simulator.ts evaluation.ts
  src/middleware   auth, validation, error handling
  src/socket       index.ts (Socket.IO handlers)
  src/lib          small shared helpers (prisma client, rng, cache)
  src/__tests__    vitest tests
  prisma/          schema.prisma seed.ts
/shared          types.ts enums.ts events.ts config.ts (imported by BOTH frontend and backend)
/ml              generate_data.py train.py requirements.txt
/docs            ASSUMPTIONS.md
/scripts         setup.mjs
AGENTS.md  README.md  docker-compose.yml  .env.example
```

Rules: frontend never imports from backend and vice versa; they only share code through `/shared`.
New REST routers are registered in `backend/src/app.ts`; Socket.IO handlers in `backend/src/socket`.

## Global config (`/shared/config.ts` — single source of truth)

- CITY: centre 12.9716, 77.5946 (Bengaluru) + ~20 km × 20 km bounding box.
- `ZONE_SIZE_KM = 1`; grid over the bbox; `zoneId = "r{row}c{col}"`.
- FARE: base 40, perKm 12, perMin 1.5, minFare 60 (INR).
  `fare = max(minFare, (base + perKm*km + perMin*min) * surge)`.
- `SIM_SPEED = 8`, `NUM_DRIVERS = 25`.
- `ALLOC_WEIGHTS = { eta: 0.45, workload: 0.2, acceptance: 0.15, idle: 0.2 }`.
- TIMEOUTS: driver response 15 s (simulated-scaled); delay threshold 30 %.
- POOL: pickup radius 1.5 km, drop radius 2 km, max detour 30 %, max riders 3, scan interval 30 s, pooled fare = solo × 0.75.
- SURGE: `clamp(1 + 0.5*(demand/supply - 1), 1.0, 2.5)` with supply floor 1.

## Ride state machine (enforce ONLY in `rideStateMachine.ts`)

States: `REQUESTED, ACCEPTED, ARRIVING, ONGOING, COMPLETED, CANCELLED, REASSIGNING`.

```
REQUESTED   -> ACCEPTED | REASSIGNING | CANCELLED
ACCEPTED    -> ARRIVING | REASSIGNING | CANCELLED
ARRIVING    -> ONGOING  | REASSIGNING | CANCELLED
ONGOING     -> COMPLETED
REASSIGNING -> ACCEPTED | REQUESTED | CANCELLED
```

Every transition validates, persists, writes a `RideEvent`, emits to passenger/driver/admin rooms. Illegal transitions throw.

## Data model (Prisma)

- **User** (id, name, email unique, passwordHash, role)
- **Driver** (id, userId, vehicleType, status OFFLINE|AVAILABLE|BUSY|REPOSITIONING, lat, lng, acceptanceRate, completedToday, busyMinutesToday, lastIdleSince, isSimulated)
- **Ride** (id, passengerId, driverId?, pickupLat/Lng, dropLat/Lng, status, distanceKm, etaMin, fareEstimate, fareFinal?, surgeMultiplier, requestedAt, acceptedAt?, startedAt?, completedAt?, promisedEtaMin, poolGroupId?, allocationScores Json?, simRunId?)
- **RideEvent** (id, rideId, type, message, payload Json, createdAt)
- **DemandHistory** (id, zoneId, hourOfDay, dayOfWeek, date, demand)
- **DemandForecast** (id, zoneId, hourOfDay, predictedDemand)
- **SimRun** (id, seed, strategy NEAREST|SMART, metrics Json, createdAt)

## Socket.IO events (`/shared/events.ts`)

- Server → client: `driver:location`, `drivers:snapshot`, `ride:status`, `ride:offer`, `ride:reassigned`, `notification`, `zones:update`, `sim:tick`.
- Client → server: `driver:setStatus`, `driver:updateLocation`, `ride:respond`, `admin:chaos`.
- Rooms: `user:{id}`, `role:admin`, `ride:{id}`.

## REST API (all under `/api`, JWT required except auth)

- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `GET /drivers/nearby?lat&lng&radiusKm`
- `POST /rides/estimate` → `{ distanceKm, etaMin, fare, surge, polyline }`
- `POST /rides`, `GET /rides/:id`, `GET /rides/history`, `POST /rides/:id/cancel`, `POST /rides/:id/respond`
- `POST /drivers/status`
- `GET /admin/zones`, `GET /admin/forecast?hour=`
- `GET /admin/recommendations`, `GET /admin/pool-candidates`
- `POST /admin/sim/start|stop|reset`, `POST /admin/chaos`
- `POST /admin/evaluate`, `GET /admin/metrics`

## Features

**Baseline:** auth (passenger/driver), driver availability + location streaming, click-map pickup/drop, nearby drivers, OSRM distance/ETA + Haversine fallback, fare estimate, matching + offer accept/reject, live 5-state ride, history with fare.

**F1 Predictive demand + proactive dispatch:** seeded synthetic 60 days × zones × 24 h (zone base × hourly peaks 8–10 / 17–20 × weekend × lognormal noise); `GradientBoostingRegressor` on zone row/col, hour, dayOfWeek, isWeekend, sin/cos hour; date-split; MAE/RMSE → `ml/model_metrics.json`; 24 h forecast for all zones → DB; admin heatmap with hour slider and Predicted/Actual/Difference; scheduler every 5 simulated minutes repositions idle drivers surplus → deficit (REPOSITIONING) with logged events + admin arrows.

**F2 Zone intelligence:** demand = last-15-sim-min requests blended with forecast; supply = available drivers; surge per the SURGE formula; applied to new rides by pickup zone; ranked recommendations `{fromZone,toZone,driversToMove,reason}`; red-scaled surge zones + supply/demand tooltips + recommendation panel.

**F3 Pooling:** every 30 s and on demand, group pending REQUESTED rides when pickups ≤1.5 km, drops ≤2 km, per-rider detour ≤30 %; enumerate stop orders with pickup-before-drop (≤90 perms for 3); one OSRM `/table` call (Haversine matrix fallback); minimize total time subject to detour limits; pooled fare = solo × 0.75; comparison card; group assigned to one driver with `poolGroupId`; pure `planPool(requests, distanceMatrix)` + tests.

**F4 Allocation + fairness:** `rankDrivers(ride, drivers, etaMap, weights)` over AVAILABLE drivers ≤5 km; min-max normalize per candidate; `score = w.eta*etaNorm + w.workload*workloadNorm + w.acceptance*(1 - acceptanceRate) - w.idle*idleNorm` (lower better), workload = busyMinutesToday + completedToday blend, idle = minutes since lastIdleSince; persist full breakdown in `Ride.allocationScores`; "Why Driver X" UI + next 2 alternates; `rankNearestOnly()` baseline; strategy flag for evaluation.

**F5 Reassignment:** triggers = reject, no response in 15 s, driver cancels mid-ride, delay where actual progress implies ETA > 30 % over `promisedEtaMin`. Transition to REASSIGNING, exclude failed driver, next-ranked offer, passenger toast ("Your driver was changed, new ETA X min"), state/event updates. No driver left → REQUESTED, retry every 10 s ×3, then notify. Admin chaos: killDriver / delayDriver / forceReject.

**Simulator:** mulberry32 seeded RNG; 25 simulated drivers (`isSimulated`, dummy users) random in bbox; move along OSRM polylines (straight-line fallback) at SIM_SPEED; `driver:location` every 1 s; auto requests from the same demand profile; auto responses using acceptanceRate with 1–8 s delay; auto lifecycle ACCEPTED → ARRIVING → ONGOING → COMPLETED; admin start/stop/reset with seed.

**Evaluation:** same seeded 30-sim-minute run twice (NEAREST vs SMART, headless where possible). Metrics: avg passenger wait, avg pickup ETA, driver utilization, completion rate, reassignments, fairness std-dev of completed rides per driver. Persist SimRun; side-by-side Recharts + table.

## Frontend

- Auth + role routing.
- `/passenger`: map, click pickup/drop, nearby drivers, estimate card (distance/ETA/fare/surge), request, live stepper, moving driver marker, "why this driver", toasts, history.
- `/driver`: online/offline, offer card with 15 s countdown + Accept/Reject, current ride stage buttons, pooled stop order.
- `/admin` tabs: Live Map, Demand Heatmap, Zones & Surge, Pooling, Allocation, Simulator + Chaos, Evaluation, Event log.
- Tailwind, clean, consistent loading/error states, mobile-friendly passenger.

## Phases

0 scaffold · 1 core services + tests · 2 core ride flow E2E · 3 simulator · 4 ML · 5a F1+F2 · 5b F4+F5 · 5c F3 · 6 evaluation · 7 demo hardening.

## Definition of done

Auth both roles; availability/nearby/distance/ETA/fare; matching + accept/reject + all 5 states live; history + fare; F1 forecast + predicted-vs-actual heatmap + pre-positioning; F2 surge + recommendations; F3 pooling + comparison; F4 explainable allocation + baseline; F5 all four reassignment triggers + notification; evaluation charts (waiting time, pickup ETA, utilization, completion rate); `npm run dev` starts everything; README accurate; tests pass.
