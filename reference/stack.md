# Tech Stack & Deployment

> Credentials, deployment details, and infrastructure reference.

---

## Architecture

```
[Withings API] → [GitHub Actions cron 6am AEST] → [Railway FastAPI] → [PostgreSQL 16]
                                                         ↑
[Vercel SPA] ← React/Vite/TS ← user → POST /api/log/* → ┘
                                         ↓
                                   [Claude Haiku 4.5]
                                   (food/strength parse, readiness narrative)
```

---

## Frontend

| Item | Value |
|------|-------|
| Framework | React + Vite + TypeScript |
| Host | Vercel |
| URL | `gavhealth.vercel.app` |
| Auth gate | Password: `<see .env VITE_GATE_PASSWORD>` |
| Vercel project ID | `prj_fxgUwqBpIWrKNTBGbtvOYJeBy7mq` |
| Vercel team ID | `team_Gwse87RecVqLNTuaAmnpXG8M` |

### Vercel Env Vars

| Var | Value |
|-----|-------|
| `VITE_API_BASE_URL` | `https://gavhealth-production.up.railway.app` |
| `VITE_API_KEY` | `<your-api-key>` |
| `VITE_GATE_PASSWORD` | `<your-gate-password>` |

---

## Backend

| Item | Value |
|------|-------|
| Framework | FastAPI (Python) |
| Database | PostgreSQL 16 |
| Host | Railway |
| URL | `https://gavhealth-production.up.railway.app` |
| API Key | `<your-api-key>` (header: `X-API-Key`) |

### Railway Env Vars

| Var | Notes |
|-----|-------|
| `DATABASE_URL` | Set by Railway |
| `API_KEY` | `<your-api-key>` |
| `ANTHROPIC_API_KEY` | Set — enables Claude Haiku 4.5 features |
| `ENVIRONMENT` | `production` |

---

## Git

| Item | Value |
|------|-------|
| Repo | `https://github.com/gavan-stil/gavhealth.git` |
| Branch | `main` |
| PAT | `<your-github-pat>` |
| User | `Gavan Stilgoe` |
| Email | `gavan@r6digital.com.au` |

### Git Push Method

**Never use git inside the mounted `/mnt/` directory.**

1. Fresh clone to `/tmp/gavhealth-push` with PAT-embedded URL
2. Copy files into clone
3. Commit and push
4. Delete temp directory

---

## AI

| Model | Usage |
|-------|-------|
| Claude Haiku 4.5 | Food NLP parse, strength NLP parse, readiness narrative |

Accessed server-side via `ANTHROPIC_API_KEY` in Railway. No client-side AI calls.

---

## Cron

GitHub Actions workflow: `.github/workflows/daily-sync.yml`
- Runs daily at 6am AEST
- Calls `POST /api/withings/sync`
- Confirmed green (Session 27)

---

## Known Infrastructure Gaps

| Gap | Impact | Resolution |
|-----|--------|------------|
| Withings OAuth not completed | Sync pulls no new data | Gav completes OAuth flow in Withings Dev Console |
| CORS set to `*` | Minor security | Tighten to Vercel domain after frontend stable |
| No HRV data | Missing readiness signal | Enable on Withings watch or defer |
