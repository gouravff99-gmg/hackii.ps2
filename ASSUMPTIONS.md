# ASSUMPTIONS.md

Decisions taken where the spec leaves room. Each is the simplest reasonable choice.

## Tooling / repo

1. **npm workspaces monorepo.** Root `package.json` owns workspaces `shared` and `apps/*`.
   `@ps02/shared` is consumed as TypeScript source (no separate build step) via workspace
   resolution, a Vite alias and a tsconfig `paths` entry. This avoids a stale `dist/`.
2. **API build = typecheck.** For the prototype, the API runs through `tsx` in dev and
   production modes (`npm run build` runs `tsc --noEmit` for the API). No bundler is added
   beyond the fixed stack.
3. **bcryptjs instead of native bcrypt.** Same API, pure JS, no Windows native build.
   Password hashes remain bcrypt-compatible.
4. **Single root `.env`.** Copy `.env.example` → `.env` at the repo root. The API and seed
   script load it explicitly by path; Prisma CLI commands are run from the repo root
   (see root scripts), so Prisma picks up the same file.
5. **Ports:** API `4000`, web `5173`. Vite proxies `/api` and `/socket.io` to the API.

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

17. **Python data hand-off via JSON:** `ml/` writes history + 24 h forecasts to JSON files,
    and `prisma/seed.ts` (or a dedicated import script) loads them into `DemandHistory` /
    `DemandForecast`. This avoids a DB driver dependency in Python and keeps a single
    Prisma write path.
18. **Python runtime:** the dev machine has Python 3.14. `requirements.txt` intentionally
    uses lower bounds so pip can pick wheels available for the installed interpreter. If
    a scientific wheel is unavailable, use a Python 3.11/3.12 virtualenv (documented in
    Phase 4).

## Scope notes

19. **Out of scope:** payment processing, real phone/OTP auth, production deployment
    manifests, multi-city support, admin user management, chat. Auth is JWT + email/password
    only.
20. **No GraphQL / message queues / microservices.** One Express process + one Socket.IO
    server + PostgreSQL.
