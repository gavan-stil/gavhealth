# T23 — Withings Sync Completeness

> Capture every field Withings provides. Live API data is source of truth.
> Fix RHR gap (Mar 5 onwards). Fix body comp gap. Store all unused fields.

**Status:** Ready to implement
**Date logged:** 2026-03-14

---

## Background

- CSV bulk import (source: `withings_csv`) ran up to Mar 5, 2026
- OAuth API sync (source: `withings`) has been running since, but misses many fields
- RHR gap: `sync_rhr` uses meastype 11 (manual spot checks) — dried up Mar 5. Data IS available in `sleep_hr_min` (already synced daily via sleep summary)
- Body comp gap: `sync_weight` only fetches meastype 1 (weight). Scale sends fat/muscle/bone/hydration in the same measure group — just not being extracted
- Several other fields fetched but silently discarded (spo2, pause_duration, pool_laps, strokes, activity intensity breakdown)

---

## Confirmed data via curl before this task

```
GET /api/rhr?limit=10          → last entry: 2026-03-05 (9-day gap)
GET /api/sleep?limit=7         → sleep_hr_min populated every day (Mar 14: 54 bpm, avg: 62 bpm)
GET /api/weight?limit=50       → fat_mass_kg present only on withings_csv rows
POST /api/withings/sync result → weight: 0, rhr: 0, sleep: 6, activities: 8, workouts: 64
Withings app                   → weight data this week ✓, HR data every day ✓
```

---

## Changes

### 1. Migration 004 — new columns

File: `backend/migrations/versions/004_withings_completeness.py`

**`sleep_logs`**
- `sleep_hr_max FLOAT` — hr_max returned by sleep summary, no column exists

**`activity_logs`**
- `spo2_avg FLOAT` — workout `spo2_average` fetched but discarded
- `pause_duration_mins FLOAT` — workout `pause_duration` (seconds → mins)
- `pool_laps INTEGER` — workout `pool_laps`
- `strokes INTEGER` — workout `strokes`
- `soft_mins FLOAT` — daily summary `soft` (light activity seconds → mins)
- `moderate_mins FLOAT` — daily summary `moderate`
- `intense_mins FLOAT` — daily summary `intense`

**`weight_logs`**
- `fat_ratio_pct FLOAT` — meastype 6 (fat %)
- `fat_free_mass_kg FLOAT` — meastype 5 (lean mass)

Note: `sleep_logs.spo2_avg` and `sleep_logs.spo2_min` already exist in the SQLAlchemy model — confirm they exist in DB via migration 001. If not, add `ADD COLUMN IF NOT EXISTS`.

---

### 2. Models — `backend/app/models/health.py`

Add to `SleepLog`:
```python
sleep_hr_max: Mapped[float | None] = mapped_column(Float)
```

Add to `ActivityLog`:
```python
spo2_avg: Mapped[float | None] = mapped_column(Float)
pause_duration_mins: Mapped[float | None] = mapped_column(Float)
pool_laps: Mapped[int | None] = mapped_column(Integer)
strokes: Mapped[int | None] = mapped_column(Integer)
soft_mins: Mapped[float | None] = mapped_column(Float)
moderate_mins: Mapped[float | None] = mapped_column(Float)
intense_mins: Mapped[float | None] = mapped_column(Float)
```

Add to `WeightLog`:
```python
fat_ratio_pct: Mapped[float | None] = mapped_column(Float)
fat_free_mass_kg: Mapped[float | None] = mapped_column(Float)
```

---

### 3. Schemas — `backend/app/schemas/health.py`

`WeightResponse` — add:
```python
fat_ratio_pct: float | None = None
fat_free_mass_kg: float | None = None
```

`SleepResponse` — add:
```python
sleep_hr_max: float | None = None
spo2_avg: float | None = None
respiratory_rate: float | None = None  # already in model, missing from schema
```

`ActivityResponse` — add:
```python
min_hr: int | None = None           # already in model, missing from schema entirely
spo2_avg: float | None = None
pause_duration_mins: float | None = None
pool_laps: int | None = None
strokes: int | None = None
soft_mins: float | None = None
moderate_mins: float | None = None
intense_mins: float | None = None
```

---

### 4. `withings_service.py` — 6 sync changes

#### 4a. `sync_weight` — fetch all body comp from measure groups

Change `meastype: 1` to fetch types `1,5,6,8,76,77,88` in one call.
Group by `grpid` to extract all measures from same scale session.
Meastype → field mapping:
- 1 → `weight_kg`
- 5 → `fat_free_mass_kg`
- 6 → `fat_ratio_pct`
- 8 → `fat_mass_kg`
- 76 → `muscle_mass_kg`
- 77 → `hydration_kg`
- 88 → `bone_mass_kg`

Upsert conflict is on `(recorded_at, source)` — one row per scale session, all body comp fields filled from same group.

#### 4b. `sync_sleep` — spo2 + hr_max

Add `spo2_average` to `data_fields` string.
In values dict, add:
```python
"sleep_hr_max": data.get("hr_max"),
"spo2_avg": data.get("spo2_average"),
```
Also add these to the `on_conflict_do_update set_` dict.

#### 4c. `sync_rhr` — no change

Keep meastype 11 as-is. If spot checks resume, they fill rhr_logs first.

#### 4d. NEW `derive_rhr_from_sleep`

Run after `sync_rhr` in `run_full_sync`.
For each sleep_log row with `sleep_hr_min` IS NOT NULL, in the last 7 days:
- Insert into `rhr_logs(log_date, rhr_bpm, source)` using `sleep_hr_min` rounded to int
- Source: `"withings"` (same source as meastype 11 so no duplicates)
- `on_conflict_do_nothing` on `(log_date, source)` — meastype 11 wins if present, sleep fills gaps

```python
async def derive_rhr_from_sleep(db: AsyncSession, since_ts: int) -> int:
    """Derive RHR from sleep_hr_min for dates with no existing rhr_logs entry."""
    since_date = datetime.fromtimestamp(since_ts, tz=timezone.utc).date()
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).date()
    effective_since = min(since_date, seven_days_ago)

    result = await db.execute(
        select(SleepLog.sleep_date, SleepLog.sleep_hr_min)
        .where(SleepLog.sleep_date >= effective_since, SleepLog.sleep_hr_min.isnot(None))
    )
    count = 0
    for row in result.all():
        stmt = pg_insert(RhrLog).values(
            log_date=row.sleep_date,
            rhr_bpm=int(row.sleep_hr_min),
            source=SOURCE,
        ).on_conflict_do_nothing(index_elements=["log_date", "source"])
        await db.execute(stmt)
        count += 1
    return count
```

#### 4e. `sync_activities` — intensity breakdown + steps audit

Add to values dict:
```python
"soft_mins": round(activity.get("soft", 0) / 60, 1) if activity.get("soft") else None,
"moderate_mins": round(activity.get("moderate", 0) / 60, 1) if activity.get("moderate") else None,
"intense_mins": round(activity.get("intense", 0) / 60, 1) if activity.get("intense") else None,
```
Add these to the `on_conflict_do_update set_` dict.
Also verify `steps` is in the set_ dict (confirm it's not missing from the upsert).

#### 4f. `sync_workouts` — spo2, pause, pool, strokes

Add to values dict:
```python
"spo2_avg": data.get("spo2_average"),
"pause_duration_mins": round(data.get("pause_duration", 0) / 60, 1) if data.get("pause_duration") else None,
"pool_laps": data.get("pool_laps"),
"strokes": data.get("strokes"),
```
Add all four to the COALESCE upsert `set_` dict (use `COALESCE(EXCLUDED.x, activity_logs.x)` pattern).

#### 4g. `run_full_sync` — add derive step

In the sync loop, after `sync_rhr`:
```python
("derive_rhr", derive_rhr_from_sleep),  # fills gaps from sleep_hr_min
```

---

### 5. Query source preference — `data.py` + `summary.py`

#### `summary.py` RHR query
Add `.order_by(RhrLog.source.desc())` so `"withings"` beats `"withings_csv"` alphabetically.

#### `data.py` sleep endpoint
Currently returns all rows including potential duplicates where both `withings` and `withings_csv` exist for the same date. Change to `DISTINCT ON (sleep_date)` preferring `withings` source:
```python
q = (
    select(SleepLog)
    .distinct(SleepLog.sleep_date)
    .order_by(SleepLog.sleep_date.desc(), SleepLog.source.desc())
)
```
This ensures `withings` beats `withings_csv` for the same date.

---

## Execution order

1. Write migration 004
2. Update `models/health.py`
3. Update `schemas/health.py`
4. Update `withings_service.py` (all 6 changes)
5. Update `summary.py` and `data.py` query fixes
6. `npm run build` — confirm no frontend breaks (no frontend changes needed)
7. Deploy to Railway — migration runs on startup via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
8. Trigger `POST /api/withings/sync` and verify:
   - `rhr` count > 0 (derived from sleep)
   - `weight` returns body comp fields for new weigh-ins

---

## Out of scope for this task

- Frontend changes — no screen wiring changes needed; screens read from DB endpoints unchanged
- HRV (`hrv_ms` in sleep_logs) — Withings doesn't expose HRV in sleep summary API
- Blood pressure (meastype 9/10) — user has ScanWatch, not BPM Connect
- Backfilling CSV-era dates with API data — accept the gap; API is source of truth from OAuth connection date forward
