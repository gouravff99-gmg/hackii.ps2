"""Train the demand forecasting model and write 24 h forecasts to PostgreSQL.

* Input : DemandHistory rows written by `ml/generate_data.py`.
* Model : scikit-learn GradientBoostingRegressor.
* Split : date-based (the last 7 days are held out for evaluation).
* Output: `ml/model_metrics.json` and one DemandForecast row per zone/hour.

Run:
    python ml/train.py
    python ml/train.py --test-days 10 --dow 5

The script only writes DemandForecast and the local metrics file.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from contextlib import closing
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

ROWS = 20
COLS = 20
TEST_DAYS = 7
MODEL_PARAMS = {
    "n_estimators": 200,
    "learning_rate": 0.08,
    "max_depth": 4,
    "subsample": 0.8,
    "random_state": 42,
}
FEATURES = [
    "zoneRow",
    "zoneCol",
    "hourOfDay",
    "dayOfWeek",
    "isWeekend",
    "sinHour",
    "cosHour",
]


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def load_env() -> None:
    env_path = repo_root() / ".env"
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def database_url() -> str:
    load_env()
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        sys.exit("[train] DATABASE_URL is not set. Configure the repo-root .env first.")
    parts = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(parts.query) if k != "schema"]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def load_history() -> pd.DataFrame:
    query = (
        'SELECT "zoneId", "hourOfDay", "dayOfWeek", "date", "demand" '
        'FROM "DemandHistory"'
    )
    with closing(psycopg2.connect(database_url())) as conn:
        frame = pd.read_sql_query(query, conn)

    if frame.empty:
        sys.exit("[train] DemandHistory is empty. Run `python ml/generate_data.py` first.")

    zones = frame["zoneId"].str.extract(r"^r(\d+)c(\d+)$")
    if zones.isna().any().any():
        sys.exit("[train] Found DemandHistory rows with an invalid zoneId.")
    frame["zoneRow"] = zones[0].astype(int)
    frame["zoneCol"] = zones[1].astype(int)
    frame["date"] = pd.to_datetime(frame["date"]).dt.date
    frame["isWeekend"] = (frame["dayOfWeek"] >= 5).astype(int)
    frame["sinHour"] = np.sin(2 * np.pi * frame["hourOfDay"] / 24)
    frame["cosHour"] = np.cos(2 * np.pi * frame["hourOfDay"] / 24)
    return frame


def split_by_date(frame: pd.DataFrame, test_days: int) -> tuple[pd.DataFrame, pd.DataFrame]:
    dates = sorted(frame["date"].unique())
    if len(dates) <= test_days:
        sys.exit(
            f"[train] Need more than {test_days} distinct dates to hold out a test window "
            f"(found {len(dates)}). Generate more history."
        )
    cutoff = dates[-test_days]
    train = frame[frame["date"] < cutoff]
    test = frame[frame["date"] >= cutoff]
    return train, test


def build_forecast_frame(day: date) -> pd.DataFrame:
    day_of_week = day.weekday()
    weekend = int(day_of_week >= 5)
    rows = []
    for row in range(ROWS):
        for col in range(COLS):
            for hour in range(24):
                rows.append(
                    {
                        "zoneId": f"r{row}c{col}",
                        "hourOfDay": hour,
                        "zoneRow": row,
                        "zoneCol": col,
                        "dayOfWeek": day_of_week,
                        "isWeekend": weekend,
                        "sinHour": np.sin(2 * np.pi * hour / 24),
                        "cosHour": np.cos(2 * np.pi * hour / 24),
                    }
                )
    return pd.DataFrame(rows)


def write_forecasts(frame: pd.DataFrame, predictions: np.ndarray) -> int:
    rows = [
        (str(zone), int(hour), float(max(0.0, value)))
        for zone, hour, value in zip(frame["zoneId"], frame["hourOfDay"], predictions)
    ]
    with closing(psycopg2.connect(database_url())) as conn:
        with conn.cursor() as cur:
            execute_values(
                cur,
                'INSERT INTO "DemandForecast" ("id", "zoneId", "hourOfDay", "predictedDemand") '
                "VALUES %s "
                'ON CONFLICT ("zoneId", "hourOfDay") '
                'DO UPDATE SET "predictedDemand" = EXCLUDED."predictedDemand"',
                [
                    (f"df_{zone}_{hour}", zone, hour, value)
                    for zone, hour, value in rows
                ],
                page_size=2000,
            )
        conn.commit()
    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the demand model and write forecasts.")
    parser.add_argument("--test-days", type=int, default=TEST_DAYS, help="held-out days (default 7)")
    parser.add_argument(
        "--dow",
        type=int,
        default=None,
        help="day of week to forecast, 0=Mon..6=Sun (default: tomorrow)",
    )
    args = parser.parse_args()

    frame = load_history()
    train, test = split_by_date(frame, args.test_days)

    model = GradientBoostingRegressor(**MODEL_PARAMS)
    model.fit(train[FEATURES], train["demand"])

    predictions = model.predict(test[FEATURES])
    mae = float(mean_absolute_error(test["demand"], predictions))
    rmse = float(np.sqrt(mean_squared_error(test["demand"], predictions)))
    baseline_mae = float(mean_absolute_error(test["demand"], np.full(len(test), train["demand"].mean())))

    forecast_day = (
        date.today() + timedelta(days=1)
        if args.dow is None
        else date.today() + timedelta(days=(args.dow - date.today().weekday()) % 7 or 7)
    )
    forecast_frame = build_forecast_frame(forecast_day)
    forecast_values = np.clip(model.predict(forecast_frame[FEATURES]), 0.0, None)
    written = write_forecasts(forecast_frame, forecast_values)

    metrics = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "model": "GradientBoostingRegressor",
        "features": FEATURES,
        "params": MODEL_PARAMS,
        "rows": {
            "total": int(len(frame)),
            "train": int(len(train)),
            "test": int(len(test)),
        },
        "dateRange": {
            "start": str(min(frame["date"])),
            "end": str(max(frame["date"])),
            "testDays": args.test_days,
        },
        "metrics": {
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "baselineMae": round(baseline_mae, 4),
        },
        "forecast": {
            "day": str(forecast_day),
            "dayOfWeek": forecast_day.weekday(),
            "rows": written,
            "meanPredictedDemand": round(float(forecast_values.mean()), 4),
        },
    }

    metrics_path = Path(__file__).resolve().parent / "model_metrics.json"
    metrics_path.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")

    print(
        f"[train] rows total={len(frame)} train={len(train)} test={len(test)} "
        f"MAE={mae:.3f} RMSE={rmse:.3f} baselineMAE={baseline_mae:.3f}"
    )
    print(f"[train] wrote {written} DemandForecast rows for {forecast_day} (dow {forecast_day.weekday()})")
    print(f"[train] metrics -> {metrics_path}")


if __name__ == "__main__":
    main()
