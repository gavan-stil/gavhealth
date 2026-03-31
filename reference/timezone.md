# Timezone & Datetime Handling

> GOE Health runs in Brisbane (UTC+10, no DST). All user-facing dates/times must reflect Brisbane local time. The database stores UTC.

---

## The Problem

Brisbane is UTC+10 with no daylight saving. This creates a 10-hour offset where:
- A workout at **6:30am Brisbane** on March 14 = **8:30pm UTC** on March 13
- Using UTC dates directly (`.toISOString().split('T')[0]`) gives **yesterday's date** for anything before 10am Brisbane

This affects every place we display or store a date.

---

## How It Works: End to End

### 1. Data enters the system

**Withings sync (backend):**
- Withings API returns UTC timestamps
- Backend converts to Brisbane date: `.astimezone(BRISBANE_TZ).date()`
- Stored in `activity_logs.activity_date` as a DATE (Brisbane local)
- Stored in `activity_logs.started_at` as TIMESTAMPTZ (UTC)

**Manual logging (frontend → backend):**
- Frontend builds a Brisbane datetime string with explicit offset: `"2026-03-14T06:30:00+10:00"`
- Backend receives this, converts to naive UTC, stores as TIMESTAMPTZ
- Pattern: `dt.astimezone(timezone.utc).replace(tzinfo=None)`

### 2. Data is stored (PostgreSQL)

| Column type | What's stored | Example |
|-------------|---------------|---------|
| `DATE` | Brisbane local date | `2026-03-14` |
| `TIMESTAMPTZ` | UTC timestamp | `2026-03-13 20:30:00+00` |

PostgreSQL TIMESTAMPTZ always stores UTC internally regardless of input timezone.

### 3. Data is displayed (frontend)

- For dates: use `new Date(isoString).toLocaleDateString('en-CA')` → `"2026-03-14"` (relies on device timezone being Brisbane)
- For times: use `new Date(isoString)` → `.getHours()/.getMinutes()` (browser converts UTC to local)
- For "today": use `new Date().toLocaleDateString('en-CA')` — NOT `.toISOString().split('T')[0]`

---

## Rules

### Frontend

| Do | Don't |
|----|-------|
| `new Date().toLocaleDateString('en-CA')` for today's date | `new Date().toISOString().split('T')[0]` — gives UTC date |
| `new Date(iso).toLocaleDateString('en-CA')` for any date | `new Date(iso).toISOString().split('T')[0]` — gives UTC date |
| `new Date().toLocaleString('sv', { timeZone: 'Australia/Brisbane' }).replace(' ', 'T') + '+10:00'` when sending datetime to backend | Sending bare `.toISOString()` — backend gets UTC time with no offset info |
| Let the browser convert UTC→local for display times | Manually adding/subtracting hours (except `useIntradayHR.ts` which is a deliberate exception) |

### Backend — SQL Queries

| Do | Don't |
|----|-------|
| `(column AT TIME ZONE 'Australia/Brisbane')::date` | `func.date(column)` or `column::date` — extracts UTC date |
| `(CURRENT_TIMESTAMP AT TIME ZONE 'Australia/Brisbane')::date` for today | `CURRENT_DATE` — gives UTC date on Railway's UTC server |
| `func.date(func.timezone('Australia/Brisbane', Column))` in SQLAlchemy ORM | `func.date(Column)` without timezone |
| `COALESCE(authoritative_ts, fallback_ts) AT TIME ZONE ...` | Using `created_at` when an event timestamp exists |

### Backend — Python

| Do | Don't |
|----|-------|
| `datetime.now(BRISBANE_TZ).date()` for "today" | `date.today()` — gives UTC date on Railway |
| `dt.astimezone(timezone.utc).replace(tzinfo=None)` before `text()` SQL | Pass tz-aware datetimes to asyncpg `text()` queries |
| `datetime.fromisoformat(s)` to parse input | Assume input is UTC |
| `val.astimezone(ZoneInfo("Australia/Brisbane")).date()` in Python | `val.date()` — gives UTC date |

---

## The asyncpg Bug

asyncpg (the PostgreSQL async driver) has a specific incompatibility with timezone-aware Python datetimes when used in SQLAlchemy `text()` queries:

```
asyncpg.exceptions.DataError: invalid input for query argument $3:
datetime.datetime(2026, 3, 11, 17, 45, ... tzinfo=...)
(can't subtract offset-naive and offset-aware datetimes)
```

**Root cause:** asyncpg internally computes `tz_aware_datetime - naive_epoch` which raises a TypeError.

**Fix:** Always strip tzinfo after converting to UTC:
```python
if dt.tzinfo is not None:
    dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
```

This gives asyncpg a naive UTC datetime, which PostgreSQL correctly interprets as UTC for TIMESTAMPTZ columns.

**Affected endpoints (all fixed 2026-03-14):**
- `POST /api/log/strength/save` — `start_time` param
- `PATCH /api/strength/sessions/{id}` — `session_datetime` param
- `POST /api/log/water` — `logged_at` param
- `POST /api/log/mood` — `logged_at` param
- `PATCH /api/activity-logs/{id}` — `started_at` param

---

## Dual-Table Strength Session Timestamps

`manual_strength_logs` and `strength_sessions` both store session timestamps. They can diverge when the user edits a session via calendar (which updates `strength_sessions.session_datetime` but historically did NOT update `manual_strength_logs.start_time`).

**Rule:** `strength_sessions.session_datetime` is the authoritative timestamp. Any query on `manual_strength_logs` that needs a date/time MUST JOIN to `strength_sessions` via `bridged_session_id` and use `COALESCE(ss.session_datetime, msl.start_time, msl.created_at)`.

**Fixed 2026-03-31:**
- `PATCH /api/strength/sessions/{id}` now syncs `manual_strength_logs.start_time` on edit
- Session picker (`recent_strength_sessions`) JOINs to `strength_sessions`
- `list_strength_sessions` JOINs to `strength_sessions`
- `last_strength_log` JOINs to `strength_sessions`

---

## Weight Date Handling

`weight_logs.recorded_at` is a TIMESTAMPTZ (UTC). Unlike `activity_logs`, which stores a dedicated `activity_date` DATE column (Brisbane local), weight has no separate date column. All date-based queries on weight must use `AT TIME ZONE` to extract the correct Brisbane date:

```sql
-- Correct
(recorded_at AT TIME ZONE 'Australia/Brisbane')::date

-- Wrong — gives UTC date
recorded_at::date
func.date(recorded_at)
```

**Fixed 2026-03-31** in:
- `data.py` — `/api/weight` date range filters, strength PRs best_date
- `summary.py` — daily summary weight lookup
- `logging.py` — bodyweight lookup for NLP strength confirm
- `new_endpoints.py` — `_lookup_bodyweight()`, energy balance `weight_days` CTE
- `export.py` — CSV export weight and sauna date extraction

---

## CURRENT_DATE vs CURRENT_TIMESTAMP AT TIME ZONE

Railway servers run in UTC. `CURRENT_DATE` returns the UTC date, which is **yesterday** in Brisbane between midnight and 10am UTC (10am–midnight Brisbane).

```sql
-- Wrong on Railway (UTC server)
WHERE activity_date >= CURRENT_DATE - INTERVAL '7 days'

-- Correct
WHERE activity_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Australia/Brisbane')::date - INTERVAL '7 days'
```

**Fixed 2026-03-31** in all routers — every `CURRENT_DATE` replaced.

---

## Python date.today() on Railway

Same problem as `CURRENT_DATE` — Python's `date.today()` returns UTC date on Railway.

```python
# Wrong
target_date = date.today()

# Correct
from zoneinfo import ZoneInfo
BRISBANE_TZ = ZoneInfo("Australia/Brisbane")
target_date = datetime.now(BRISBANE_TZ).date()
```

**Fixed 2026-03-31** in:
- `summary.py` — daily/weekly summary default dates
- `logging.py` — food parse default log_date
- `new_endpoints.py` — strength save fallback session_date

---

## Known Exceptions

- **`useIntradayHR.ts`**: Manually adds 10h to UTC time (`now.setTime(now.getTime() + 10 * 3600 * 1000)`) — this is intentional and correct for computing Brisbane date without relying on device timezone.

---

## Checklist for New Features

When adding a new feature that involves dates or times:

1. **New TIMESTAMPTZ column?** Every query extracting a date from it needs `AT TIME ZONE 'Australia/Brisbane'`
2. **New date-range filter?** Use `(CURRENT_TIMESTAMP AT TIME ZONE 'Australia/Brisbane')::date`, not `CURRENT_DATE`
3. **Python default date?** Use `datetime.now(BRISBANE_TZ).date()`, not `date.today()`
4. **Python `.date()` on a datetime?** Use `.astimezone(BRISBANE_TZ).date()` instead
5. **Frontend date from ISO string?** Use `new Date(iso).toLocaleDateString('en-CA')`, not `.toISOString().split('T')[0]`
6. **Two tables storing the same timestamp?** Designate one as authoritative, JOIN to it, keep them in sync on edits
7. **New `func.date()` in SQLAlchemy ORM?** Wrap: `func.date(func.timezone('Australia/Brisbane', Column))`

---

## Debugging Checklist

If a date/time looks wrong:

1. **Off by one day?** → UTC date being used instead of Brisbane local. Check for `.toISOString().split('T')[0]`, `func.date()` without timezone, `CURRENT_DATE`, or `date.today()`.
2. **"Can't subtract offset-naive and offset-aware"?** → asyncpg getting a tz-aware datetime. Add `.replace(tzinfo=None)` after `.astimezone(timezone.utc)`.
3. **COALESCE with NULL fails?** → Python `None` passed to asyncpg for a typed column. Resolve to a real `datetime` before the query.
4. **Time shows wrong but date is right?** → Check if two tables store the same timestamp and have diverged. Use the authoritative source.
5. **Date right in calendar but wrong elsewhere?** → Calendar reads from `strength_sessions`; other views may read from `manual_strength_logs`. Ensure JOINs are in place.
