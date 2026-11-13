# ASSUMPTIONS.md

Decisions taken where the spec leaves room. Each is the simplest reasonable choice.

## Tooling / repo

1. **npm workspaces monorepo.** Root `package.json` owns workspaces `shared`, `backend` and
   `frontend`. `@ps02/shared` is consumed as TypeScript source via workspace resolution, Vite
   aliases and tsconfig `paths`; no separate build output is needed.
2. **Backend build = typecheck.** The backend runs through `tsx` in dev and production modes;
   `npm run build` runs `tsc --noEmit`. No additional bundler is used.
3. **bcryptjs instead of native bcrypt.** It has a compatible API without a native build.
   Password hashes remain bcrypt-compatible.
4. **Single root `.env`.** Copy `.env.example` to `.env`. The backend and seed script load it by
   path; root Prisma scripts use the same file.
5. **Ports:** backend `4000`, frontend `5173`. Vite proxies `/api` and `/socket.io` to the backend.

## Data model

6. **Prisma enums mirror `shared/src/enums.ts`** (`Role`, `DriverStatus`, `RideStatus`,
   `SimStrategy`). Socket/event types stay strings for flexibility.
7. **`vehicleType`** is stored as a string (`HATCHBACK | SEDAN | SUV` suggested in shared enums)
   rather than a DB enum, so the value set can grow without a migration.
8. **Demonstration seed users** are `admin@demo.com`, `passenger@demo.com` and `driver@demo.com`
   (password `password123`). Phase 7 may add richer demo data.
9. **Availability metadata** (`busyMinutesToday`, `completedToday`, `lastIdleSince`) is persisted
   on `Driver`; ephemeral timers, caches and in-flight simulation state live in memory.

## Geo / routing

10. **Bounding box:** 20 km × 20 km centred on Bengaluru, approximately ±0.09042° latitude and
    ±0.09218° longitude. Row 0 is the north edge, column 0 the west edge; `zoneId = r{row}c{col}`.
11. **OSRM Haversine fallback** multiplies great-circle distance by 1.3 to approximate road
    distance; duration uses a fixed average speed.
12. **Cache key:** coordinates rounded to 4 decimals, with both directions cached for `/table`.
13. **Nominatim** is optional search only (max 1 request per second, cached); click-on-map is the
    primary input.

## Simulation / time

14. **Simulated-scaled timers:** in simulator mode, wall-clock timers are divided by `SIM_SPEED`
    (for example, a 15 s driver response timeout becomes about 1.9 s at ×8). Real-user rides use
    the literal 15 s timeout.
15. **Simulated day/time** starts at the current local time and advances at `SIM_SPEED`; demand
    profiles use that simulated clock.
16. **Evaluation** runs headless by default (no socket emission required) and shares pure planning
    functions with the live simulator.

## ML

17. **Python writes to PostgreSQL directly.** `ml/generate_data.py` and `ml/train.py` use
    `psycopg2` with the root `DATABASE_URL` (stripping Prisma's `?schema=` parameter). They only
    touch `DemandHistory` and `DemandForecast`; `generate_data.py` refuses to overwrite existing
    history without `--reset`. `ml/model_metrics.json` records MAE/RMSE, the date split and forecast
    day.
18. **Python runtime:** scripts target Python 3.9+ (pandas 2.x, scikit-learn 1.3+). Install
    `ml/requirements.txt` in a virtual environment; if a scientific wheel is unavailable for the
    installed interpreter, use Python 3.11/3.12.

## Scope notes

19. **Out of scope:** payment processing, real phone/OTP auth, production deployment manifests,
    multi-city support, admin user management and chat. Auth is JWT + email/password only.
20. **No GraphQL, message queues or microservices.** One Express process, one Socket.IO server and
    PostgreSQL.

## Implemented behaviour

21. **Folders are named by role:** `frontend/` and `backend/` (previously `apps/web`, `apps/api`).
22. **Demo emails use `@demo.com`.** Zod's `.email()` rejects dotless domains such as `admin@demo`.
23. **Simulator speed / fleet size are not in `.env`.** `shared/src/config.ts` is the single source.
24. **Workload blend.** `workload = busyMinutesToday + completedToday × 10`
    (`WORKLOAD_COMPLETED_RIDE_MINUTES`), so each completed ride counts like ten busy minutes.
25. **Zone demand blend.** The trailing 15-minute request count is scaled to an hourly rate and
    blended 50/50 with the ML forecast for the same hour when available; otherwise observed demand
    is used alone.
26. **Grid size.** The 20 km × 20 km bounding box yields a fixed 20 × 20 grid
    (`ZONE_GRID.rows/cols`). Admin endpoints return all 400 zones, including zero-demand cells.
27. **Driver earnings.** The UI shows `fare × (1 − 0.20)`; 20% commission is a display assumption,
    not a persisted payout record.
28. **Delay trigger.** Reassignment fires when current ETA to the destination exceeds
    `promisedEtaMin × 1.3`; the threshold lives in `TIMEOUTS.delayThreshold`.
29. **Reassignment fallback.** With no candidate left, the ride returns to `REQUESTED` and retries
    every 10 seconds, up to three times, before notifying the passenger.
30. **Pooling UI.** The admin pooling tab shows planner output (stop order, detour, solo vs pooled
    fare). Grouped rides receive a shared `poolGroupId` when a plan is applied.
31. **Admin Settings is read-only.** It displays the signed-in account, `/api/health` and compiled
    `shared/src/config.ts` values; there is no API for editing users or runtime settings.
32. **Error envelope.** API errors are `{ error: { code, message, details? } }`; unknown routes
    return `404` with `code: "not_found"`. The frontend surfaces the message.
33. **Live allocation strategy.** SMART is the only live strategy; NEAREST exists only as the
    evaluation baseline.
34. **Tests.** Pure services (fare, surge, matching, pooling, ride state machine, evaluation) have
    Vitest unit tests. The health test tolerates an unreachable database.
