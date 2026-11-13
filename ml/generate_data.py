"""Generate 60 days of synthetic zone demand history into PostgreSQL.

Model (matches the project spec):
    demand = zone_base x hourly_peak x weekend_factor x lognormal_noise

* 20 x 20 zone grid derived from the shared city bounding box
  (`zoneId = r{row}c{col}`, row 0 = north, column 0 = west).
* 60 days ending yesterday, 24 hours per day, one row per zone/hour/day.
* Deterministic for a given --seed.

Run:
    python ml/generate_data.py                # skip if history already exists
    python ml/generate_data.py --reset        # clear DemandHistory first
    python ml/generate_data.py --days 90 --seed 7

The script only ever touches the DemandHistory table.
"""

from __future__ import annotations

import argparse
import math
import os
import random
import sys
from contextlib import closing
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# --- Shared config (mirrors shared/src/config.ts) --------------------------

CITY_CENTER = (12.9716, 77.5946)
BOUNDS = {"north": 13.06202, "south": 12.88118, "east": 77.68678, "west": 77.50242}
ROWS = 20
COLS = 20
DAYS = 60
SEED = 2026

# Hour-of-day multipliers. Morning (8-10) and evening (17-20) peaks.
PEAK_HOURS = {8: 1.7, 9: 1.9, 10: 1.7, 17: 1.8, 18: 2.0, 19: 2.0, 20: 1.8}
NIGHT_FACTOR = 0.25
WEEKEND_FACTOR = 0.85
NOISE_SIGMA = 0.35


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def load_env() -> None:
    """Load the repo-root .env without overriding real environment variables."""
    env_path = repo_root() / ".env"
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def database_url() -> str:
    load_env()
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        sys.exit(
            "[generate_data] DATABASE_URL is not set. Copy .env.example to .env "
            "and point it at a running PostgreSQL instance."
        )
    # psycopg2 does not understand Prisma's ?schema=public query parameter.
    parts = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(parts.query) if k != "schema"]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def connect():
    # Imported lazily so `--dry-run` works with a bare Python install.
    import psycopg2

    return psycopg2.connect(database_url())


# --- Demand model -----------------------------------------------------------


def km_per_deg_lng(lat: float) -> float:
    return 111.32 * math.cos(math.radians(lat))


def zone_centers() -> list[tuple[str, float, float]]:
    lat_span = BOUNDS["north"] - BOUNDS["south"]
    lng_span = BOUNDS["east"] - BOUNDS["west"]
    lat_step = lat_span / ROWS
    lng_step = lng_span / COLS

    zones: list[tuple[str, float, float]] = []
    for row in range(ROWS):
        for col in range(COLS):
            lat = BOUNDS["north"] - (row + 0.5) * lat_step
            lng = BOUNDS["west"] + (col + 0.5) * lng_step
            zones.append((f"r{row}c{col}", lat, lng))
    return zones


def distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    h = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return 2 * 6371 * math.asin(min(1.0, math.sqrt(h)))


def zone_base(lat: float, lng: float) -> float:
    """Central zones are busier; demand decays smoothly towards the edges."""
    dist = distance_km(CITY_CENTER[0], CITY_CENTER[1], lat, lng)
    return 3.5 + 26.0 * math.exp(-((dist / 4.5) ** 2))


def hourly_peak(hour: int) -> float:
    if hour in PEAK_HOURS:
        return PEAK_HOURS[hour]
    if 0 <= hour <= 5:
        return NIGHT_FACTOR
    return 1.0


def build_rows(days: int, seed: int) -> list[tuple[str, int, int, date, int]]:
    rng = random.Random(seed)
    zones = zone_centers()
    bases = {zone_id: zone_base(lat, lng) for zone_id, lat, lng in zones}

    today = date.today()
    first_day = today - timedelta(days=days)
    rows: list[tuple[str, int, int, date, int]] = []

    for offset in range(days):
        day = first_day + timedelta(days=offset)
        day_of_week = day.weekday()  # 0 = Monday, 6 = Sunday
        weekend = day_of_week >= 5
        for zone_id, _, _ in zones:
            base = bases[zone_id]
            for hour in range(24):
                mean = base * hourly_peak(hour)
                if weekend:
                    mean *= WEEKEND_FACTOR
                noise = rng.lognormvariate(0.0, NOISE_SIGMA)
                demand = int(round(mean * noise))
                rows.append((zone_id, hour, day_of_week, day, max(0, demand)))

    return rows


# --- Entry point ------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic demand history.")
    parser.add_argument("--days", type=int, default=DAYS, help="days of history (default 60)")
    parser.add_argument("--seed", type=int, default=SEED, help="RNG seed (default 2026)")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="delete existing DemandHistory rows before inserting (only that table)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="build and summarise rows without touching the database",
    )
    args = parser.parse_args()

    if args.days < 7:
        sys.exit("[generate_data] --days must be at least 7 (train/test split needs a week).")

    rows = build_rows(args.days, args.seed)

    if args.dry_run:
        demand = [row[4] for row in rows]
        print(
            f"[generate_data] dry run: {len(rows)} rows across {ROWS * COLS} zones "
            f"for {args.days} days (seed {args.seed})."
        )
        print(
            f"[generate_data] demand min={min(demand)} max={max(demand)} "
            f"mean={sum(demand) / len(demand):.2f} total={sum(demand)}"
        )
        return

    from psycopg2.extras import execute_values

    with closing(connect()) as conn:
        with conn.cursor() as cur:
            cur.execute('SELECT COUNT(*) FROM "DemandHistory"')
            existing = cur.fetchone()[0]

            if existing and not args.reset:
                print(
                    f"[generate_data] DemandHistory already has {existing} rows; "
                    "nothing to do. Re-run with --reset to regenerate."
                )
                return

            if args.reset:
                cur.execute('DELETE FROM "DemandHistory"')
                print(f"[generate_data] cleared {existing} existing rows")

            execute_values(
                cur,
                'INSERT INTO "DemandHistory" ("id", "zoneId", "hourOfDay", "dayOfWeek", "date", "demand") '
                "VALUES %s",
                [
                    (f"dh_{zone}_{day.isoformat()}_{hour}", zone, hour, dow, day, demand)
                    for zone, hour, dow, day, demand in rows
                ],
                page_size=5000,
            )
        conn.commit()

    total = sum(row[4] for row in rows)
    print(
        f"[generate_data] inserted {len(rows)} rows across {ROWS * COLS} zones "
        f"for {args.days} days (seed {args.seed}, total demand {total})."
    )
    print("[generate_data] next: python ml/train.py")


if __name__ == "__main__":
    main()
