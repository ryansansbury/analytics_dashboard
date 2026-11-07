# Setup

## Requirements

- **Python 3.11+**
- **Node 22+**
- **PostgreSQL 15+**. The application and CI run on it. The newer endpoints
  also run on SQLite, which is how the unit tests exercise them, but
  `/api/revenue/trends` uses `date_trunc` and needs PostgreSQL.

`./scripts/setup-local.sh` checks for all three, creates the database, and
installs both halves' dependencies.

## Docker

```bash
docker compose up
```

Brings up PostgreSQL and the Flask service. Seed it once the database is
accepting connections:

```bash
docker compose exec backend python reseed.py
```

## Local

### Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

export DATABASE_URL=postgresql://localhost:5432/analytics_dashboard
createdb analytics_dashboard          # if it does not exist yet

python reseed.py                      # generates the dataset, a few minutes
python run.py                         # http://localhost:5001
```

Port 5001 rather than 5000, because AirPlay Receiver occupies 5000 on macOS.

`reseed.py` drops and recreates every table. It reads `DATABASE_URL`, so
confirm what that points at before running it, particularly if your shell
profile exports one globally for another project.

### Frontend

```bash
cd frontend
npm ci
npm run dev                           # http://localhost:3000
```

The dev server proxies `/api` to Flask on 5001, so both halves share an origin
and no CORS configuration is needed locally.

## Verifying the install

```bash
curl -s localhost:5001/api/health | python3 -m json.tool
```

`status` is `healthy` with `data.seeded: true` once the dataset is loaded. If it
reports `degraded`, the `hint` field says what to do. This endpoint exists
because every other endpoint returns 200 with empty results against an empty
database, which is correct behaviour and indistinguishable from a broken
deployment when you are staring at a blank dashboard.

## Tests

```bash
cd backend  && python -m pytest -q              # 116 tests
cd frontend && npm run lint && npm test         # 184 tests
```

The cross-endpoint consistency suite needs PostgreSQL and skips without it:

```bash
createdb analytics_dashboard_test
TEST_DATABASE_URL=postgresql://localhost:5432/analytics_dashboard_test \
  python -m pytest -q
```

Those fixtures call `drop_all()`. The suite refuses to run against a database
whose name does not end in `_test`, because pointing it at a working database
destroys the data in it and every test still passes.

## Environment variables

### Backend

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/analytics_dashboard` | Connection string. `postgres://` is rewritten to `postgresql://` for SQLAlchemy 2. |
| `FLASK_ENV` | `development` | Selects the config class. |
| `SECRET_KEY` | dev placeholder | Set a real value in production. |
| `TEST_DATABASE_URL` | `...analytics_dashboard_test` | Tests only. Must end in `_test`. |

### Frontend

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `/api` | API base. Leave unset to use the dev proxy. |
| `VITE_STATIC_DATA` | unset | `true` builds the static demo, reading `public/data/` instead of the network. |

Copy `.env.example` to `.env` as a starting point. `.env` is gitignored.

## Production build

```bash
cd frontend && npm run build          # emits dist/
```

Copy `dist/` to `backend/static/` and Flask serves it same-origin with the API,
with SPA fallback for client routes. That directory is gitignored: it is build
output, and tracking it meant the committed bundle drifted out of sync with the
source that produced it.

## The hosted demo

```bash
./scripts/refresh-demo.sh              # reseed, snapshot, test, build, stage into the site
./scripts/refresh-demo.sh --no-stage   # everything except staging
./scripts/refresh-demo.sh --check-live # after the site's deploy, check the live demo
```

The demo is served from `/analytics-dashboard/` on www.ryansansbury.com, so a static
build is based at that folder. Preview one locally with
`cd frontend && VITE_STATIC_DATA=true npx vite preview --port 4455` and open
`http://localhost:4455/analytics-dashboard/`.

This is a different artifact from the production build above: a static snapshot
with no server and no database. See `ARCHITECTURE.md`. The coverage test runs
before the deploy, so a snapshot missing an endpoint stops the release rather
than reaching production as a blank chart.
