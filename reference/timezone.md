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

### Backend (Python / asyncpg)

| Do | Don't |
|----|-------|
| `dt.astimezone(timezone.utc).replace(tzinfo=None)` before passing to `text()` SQL | Pass tz-aware datetimes to asyncpg `text()` queries |
| `datetime.fromisoformat(s)` to parse input | Assume input is UTC |
| Use `AT TIME ZONE 'Australia/Brisbane'` in SQL for date extraction | `func.date(column)` — extracts UTC date |
| Resolve `None` to a typed `datetime` before the query | Pass Python `None` to `COALESCE(:param::timestamptz, NOW())` |

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

## Known Exceptions

- **`useIntradayHR.ts`**: Manually adds 10h to UTC time (`now.setTime(now.getTime() + 10 * 3600 * 1000)`) — this is intentional and correct for computing Brisbane date without relying on device timezone.
- **`data.py:73`**: `func.date(WeightLog.recorded_at)` extracts UTC date, not Brisbane date. Not yet fixed — low impact since weight is typically logged midday.

---

## Debugging Checklist

If a date/time looks wrong:

1. **Off by one day?** → UTC date being used instead of Brisbane local. Check for `.toISOString().split('T')[0]` or `func.date()` without timezone conversion.
2. **"Can't subtract offset-naive and offset-aware"?** → asyncpg getting a tz-aware datetime. Add `.replace(tzinfo=None)` after `.astimezone(timezone.utc)`.
3. **COALESCE with NULL fails?** → Python `None` passed to asyncpg for a typed column. Resolve to a real `datetime` before the query.
4. **Time shows wrong but date is right?** → Check if backend is returning UTC and frontend is displaying without conversion, or vice versa.
