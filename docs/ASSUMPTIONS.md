# ASSUMPTIONS.md

Decisions taken where the spec leaves room. Each is the simplest reasonable choice.

## Tooling / repo

1. **npm workspaces monorepo.** Root `package.json` owns workspaces `shared`, `backend` and `frontend`.
   `@ps02/shared` is consumed as TypeScript source (no separate build step) via workspace
   resolution, a Vite alias and a tsconfig `paths` entry. This avoids a stale `dist/`.
2. **Backend build = typecheck.** For the prototype, the backend runs through `tsx` in dev and
   production modes (`npm run build` runs `tsc --noEmit` for the backend). No bundler is added
   beyond the fixed stack.
3. **bcryptjs instead of native bcrypt.** Same API, pure JS, no Windows native build.
   Password hashes remain bcrypt-compatible.
4. **Single root `.env`.** Copy `.env.example` → `.env` at the repo root. The backend and seed
   script load it explicitly by path; Prisma CLI commands are run from the repo root
   (see root `db:*` scripts), so Prisma picks up the same file.
5. **Ports:** backend `4000`, frontend `5173`. Vite proxies `/api` and `/socket.io` to the backend.

## Data model

6. **Prisma enums mirror `shared/src/enums.ts` exactly** (`Role`, `DriverStatus`,
   `RideStatus`, `SimStrategy`). Socket/event types stay strings for flexibility.
7. **`vehicleType`** is stored as a string (`HATCHBACK | SEDAN | SUV` suggested in shared
   enums) rather than a DB enum, so the value set can grow without a migration.
8. **Demonstration seed users** exist from Phase 0: `admin@demo`, `passenger@demo`,
   `driver@demo` (password `password123`). Phase 7 may add richer demo data.
9. **Availability metadata** (`busyMinutesToday`, `completedToday`, `lastIdleSince`) is
   persisted on `Driver`; ephemeral things (offer timers, caches, in-flight sim state) live
   in memory.

## Geo / routing

10. **Bounding box:** 20 km × 20 km centred on Bengaluru, so ±0.09042° latitude and
    ±0.09218° longitude. Row 0 is the **north** edge, column 0 the **west** edge;
    `zoneId = r{row}c{col}`.
11. **OSRM Haversine fallback** multiplies great-circle distance by **1.3** to approximate
    road distance; duration is derived from that distance using a fixed average speed
    (defined in `geo.ts` in Phase 1).
12. **Cache key:** coordinates rounded to 4 decimals, both directions for `/table`.
13. **Nominatim** is optional search only (max 1 req/s, cached); click-on-map is the primary
    input.

## Simulation / time

14. **Simulated-scaled timers:** in simulator mode, wall-clock timers are divided by
    `SIM_SPEED` (e.g. a 15 s driver response timeout becomes ~1.9 s wall-clock at ×8).
    Real-user rides use the literal 15 s timeout.
15. **Simulated day/time** starts at the current local time and advances at `SIM_SPEED`;
    the demand profile uses that simulated clock.
16. **Evaluation** runs headless by default (no socket emission required) so it finishes
    quickly; the live simulator and evaluation share the same pure planning functions.

## ML (Phase 4)

<<<<<<< HEAD
17. **Python writes to PostgreSQL directly.** `ml/generate_data.py` and `ml/train.py` use
    `psycopg2` with the same root `DATABASE_URL` (Prisma's `?schema=` parameter is stripped).
    They only touch `DemandHistory` / `DemandForecast`, and `generate_data.py` refuses to
    overwrite existing history without `--reset`. No JSON hand-off or second write path is
    needed. `ml/model_metrics.json` records MAE/RMSE, the date split and the forecast day.
18. **Python runtime:** scripts target Python 3.9+ (pandas 2.x, scikit-learn 1.3+). Install
    `ml/requirements.txt` in a virtualenv; if a scientific wheel is unavailable for the
    installed interpreter, use Python 3.11/3.12.

## Scope notes

19. **Out of scope:** payment processing, real phone/OTP auth, production deployment
    manifests, multi-city support, admin user management, chat. Auth is JWT + email/password
    only.
20. **No GraphQL / message queues / microservices.** One Express process + one Socket.IO
    server + PostgreSQL.
=======
17. **Python data hand-off via JSON:** `ml/` writes history + 24 h forecasts to JSON files,
    and `backend/prisma/seed.ts` (or a dedicated import script) loads them into `DemandHistory` /
    `DemandForecast`. This avoids a DB driver dependency in Python and keeps a single
    Prisma write path.
18. **Python runtime:** the dev machine has Python 3.14. `requirements.txt` intentionally
    uses lower bounds so pip can pick wheels available for the installed interpreter. If
    a scientific wheel is unavailable, use a Python 3.11/3.12 virtualenv (documented in
    Phase 4).
>>>>>>> 2c9d961896379c7a559888f959bc1f6d16bab32a

## Added in the cleanup pass

21. **Folders are named by role:** `frontend/` and `backend/` (previously `apps/web`, `apps/api`).
22. **Demo emails use a real-looking domain** (`@demo.com`). `zod`'s `.email()` rejects
    dotless domains such as `admin@demo`, which would have broken login validation.
23. **Simulator speed / fleet size are not in `.env`.** `shared/src/config.ts` is the only place.

<<<<<<< HEAD
## Implemented behaviour (details the spec leaves open)

24. **Workload blend.** `workload = busyMinutesToday + completedToday × 10`
    (`WORKLOAD_COMPLETED_RIDE_MINUTES`), so each completed ride counts like ten busy minutes.
25. **Zone demand blend.** Demand is the trailing 15-minute request count scaled to an hourly
    rate, blended 50/50 with the ML forecast for the same hour when a forecast row exists.
    Without a forecast it uses observed demand alone.
26. **Grid size.** The 20 km × 20 km bbox yields a fixed 20 × 20 grid (`ZONE_GRID.rows/cols`).
    Admin endpoints always return all 400 zones, including zero-demand cells.
27. **Driver earnings.** The UI shows `fare × (1 − 0.20)`; the 20 % commission is a display
    assumption, not a persisted payout record.
28. **Delay trigger.** Reassignment fires when the current ETA to the destination exceeds
    `promisedEtaMin × 1.3`; the threshold lives in `TIMEOUTS.delayThreshold`.
29. **Reassignment fallback.** With no candidate left, the ride returns to `REQUESTED` and is
    retried every 10 s, up to three times, before the passenger is notified.
30. **Pooling UI.** The admin pooling tab shows the planner output (stop order, detour, solo vs
    pooled fare). Grouped rides receive a shared `poolGroupId` when a plan is applied; the
    planner itself is pure and can be inspected without persisting.
31. **Admin Settings is read-only.** It displays the signed-in account, `/api/health` and the
    compiled `shared/src/config.ts` values. There is no API for editing users or runtime
    settings, so no fake toggles are shown.
32. **Error envelope.** API errors are `{ error: { code, message, details? } }`; unknown routes
    return `404` with `code: "not_found"`. The frontend surfaces `message` and maps statuses to
    friendly states.
33. **Live allocation strategy.** SMART is the only live strategy; NEAREST exists solely as the
    evaluation baseline.
34. **Tests.** Pure services (fare, surge, matching, pooling, ride state machine, evaluation) are
    unit-tested with vitest. The health test intentionally tolerates an unreachable database.
=======
## Scope notes

19. **Out of scope:** payment processing, real phone/OTP auth, production deployment
    manifests, multi-city support, admin user management, chat. Auth is JWT + email/password
    only.
20. **No GraphQL / message queues / microservices.** One Express process + one Socket.IO
    server + PostgreSQL.
>>>>>>> 2c9d961896379c7a559888f959bc1f6d16bab32a
