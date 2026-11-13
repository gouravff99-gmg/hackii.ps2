# ml/ — offline demand forecasting (Phase 4)

Runs **offline**; the API never calls Python at runtime.

Planned files:

| File | Purpose |
| --- | --- |
| `generate_data.py` | Seeded synthetic demand history (60 days x zones x 24 h) |
| `train.py` | GradientBoostingRegressor, writes `model_metrics.json` + forecast JSON |
| `requirements.txt` | pandas, scikit-learn, numpy |

Output JSON is loaded into the DB by the backend seed/import script (see `docs/ASSUMPTIONS.md` #17).
