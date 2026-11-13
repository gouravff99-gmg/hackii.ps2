# Root-cause report — area-wise demand heatmap

Date: 2026-11-14
Status: diagnosis before implementation (no destructive changes).

## What the existing heatmap actually is

There are **three different heatmap implementations** in the app:

1. **Admin `DemandIntelligence` grid heatmap** (`frontend/src/pages/admin/DemandIntelligence.tsx`)
   - 1 km cells derived from `CITY.bounds` (Bengaluru).
   - Values come from `DemandForecast` rows and from rides requested in the last 15 minutes.
   - Rendered as unlabelled grid squares (`r{row}c{col}`), not geographic localities.

2. **Mobility control tower** (`frontend/src/pages/admin/MobilityControlTower.tsx`)
   - Circle markers on the same Bengaluru 1 km grid, using `getMobilityIntelligence()`.
   - Same grid / same coordinate filter.

3. **Karnataka district demo overlay** (`frontend/src/pages/admin/KarnatakaDemoHeatmap.tsx`)
   - 31 district-centre circles generated **client-side** from `shared/src/karnatakaDemo.ts`.
   - Deterministic, but only district level; no Belagavi localities, no vehicle categories,
     no persistence, and no connection to real rides.

None of these is an area polygon map. None supports Bike / Car / Pooling separately.

## Root causes

### RC-1 — Coordinate system mismatch (primary cause of "heatmap is empty/wrong")

`shared/src/config.ts` fixes `CITY` to Bengaluru (12.97, 77.59) with a ~20 km bounding box.
`backend/src/services/geo.ts` filters every ride and driver through `pointInBounds()`
and drops anything outside that box.

The live database shows the app is actually being used in **Belagavi**:

* 9 of 14 rides have pickup coordinates in Belagavi (e.g. 15.8368581, 74.5019281 = Tilakwadi,
  15.8174629, 74.4926262 = Udyambag).
* The one real driver is in Belagavi.
* All 25 simulator drivers are in Bengaluru because the simulator spawns inside `CITY.bounds`.

Result: Belagavi rides and drivers are silently excluded from the zone heatmap, and the
simulator traffic is in a different city. The grid is therefore "correct but looking at the
wrong place".

### RC-2 — No forecast data was ever seeded

`DemandForecast` and `DemandHistory` both have **0 rows**. The admin heatmap is built around
`GET /admin/forecast` and `getZoneMetrics()` blends forecast with live requests. With no ML
output and no recent live requests, almost every cell is rendered as "no data". The existing
warning says "run ml/train.py", but nothing seeds/loads Belagavi demand.

### RC-3 — No geographical area hierarchy

The data model only knows `zoneId = "r{row}c{col}"` and district centres. There is no
state → district → taluk → city → locality model, no polygons, and no locality labels such as
Tilakwadi / Shahapur / Udyambag. The requirement is area-wise polygons, so a 1 km grid or
district dot cannot answer "which locality has demand at what time".

### RC-4 — Vehicle categories do not exist in the domain

`VehicleType` is `HATCHBACK | SEDAN | SUV` (vehicle body style). There is no
`BIKE | CAR | POOL` service category on `Driver` or `Ride`, no pool-enabled flag, no pool
capacity/seats. Therefore:

* bike and car demand cannot be separated;
* a pooled car cannot be counted as one vehicle with seats rather than several cars;
* dispatch cannot filter by service category.

The existing `pooling.ts` is a **planner/analytics module only**. It has no passenger-facing
POOL booking category, no seat model and no persistence of pooled groups.

### RC-5 — Demo data is client-side only and district-only

`generateKarnatakaDistrictDemo()` is deterministic and useful, but it is computed in the
browser, has no Belagavi localities, no 7 time windows, no categories, and no source label.
Changing the scenario only affects that one component. Other charts / APIs cannot see it.
There is no shared, testable data engine that the passenger, driver and admin views can all use.

### RC-6 — Real-time updates exist but are not connected to area demand

`zones:update` is emitted on ride creation, status changes and driver status/location changes,
but the area heatmap does not consume it. Supply/demand changes in the DB are not reflected in
any area view. Deduplication is not a problem yet because there are no counters to double count;
the fix should keep DB queries as the source of truth.

### RC-7 — Duplicated / conflicting views

`DemandIntelligence` renders both `MobilityControlTower` and `KarnatakaDemoHeatmap` with
different data sources and different meanings, without a single hierarchy or source label.
A user cannot tell whether a colour means live pressure, a model forecast or a synthetic score.

## Fix strategy (small, reversible)

1. Add a shared, deterministic **area demand engine** with 10 Belagavi operational-zone
   polygons, 7 time windows, weekday/weekend patterns, 6 demo scenarios and separate
   Bike / Car / Pooling metrics. It is pure and unit-tested.
2. Add **VehicleCategory** to Prisma (`Ride.category`, `Driver.vehicleCategory`,
   `Driver.poolEnabled`, `Driver.seatCapacity`) with a non-destructive migration.
   Reuse the existing `VehicleType` for vehicle body style; do not replace it.
3. Add one backend service (`areaDemand.ts`) that merges:
   * synthetic DEMO data (deterministic, never random per refresh), and
   * LIVE counts from real `Ride` / `Driver` rows mapped to polygons.
   Every area reports its own source; the values are never summed without a visible label.
4. Expose it through **one** new authenticated endpoint (`GET /api/intelligence/areas`) with
   filters for scenario, day, time window, category, source, date and optional origin.
5. Wire it into passenger, driver and admin screens. Keep the existing 1 km grid and simulator
   intact and clearly label the legacy view as a Bengaluru-configuration forecast grid.
6. Keep Socket.IO event names unchanged; refetch area demand on existing `zones:update`
   (and on a slow polling fallback). The database is the source of truth, so events cannot
   double count.
7. Do not change `CITY` or delete any existing table/row. The new Belagavi hierarchy is
   additive and explicitly labelled "operational zones, not official boundaries".

## Non-goals / explicit limitations

* Operational-zone polygons are approximate and are **not** official administrative boundaries.
* Synthetic request numbers are illustrative demo data, not measured Belagavi statistics.
* Automatic live co-rider merging during an in-progress ride is not rebuilt. Pooling requests
  are a distinct category and pool capacity/seats are reported; the existing planner remains
  the grouping engine for analysis.
* No fake GPS or fake live rides are introduced.
