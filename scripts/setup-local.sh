#!/usr/bin/env bash
#
# Get this machine ready to run the dashboard and refresh its demo.
#
#   ./scripts/setup-local.sh
#
# It checks for a PostgreSQL server and a Python the backend's pinned libraries
# support (3.11 to 3.13), creates the analytics_dashboard database if it's
# missing, builds backend/venv from requirements.txt, and installs the frontend's
# packages if they're missing. It installs no system software. When PostgreSQL
# or a suitable Python is missing it prints the Homebrew command to run and
# stops, and running it again picks up from there.
#
# Then ./scripts/refresh-demo.sh --no-deploy --yes reseeds, snapshots, tests,
# and builds the demo without publishing it.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$REPO/backend"
FRONTEND="$REPO/frontend"
DB_NAME="analytics_dashboard"

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
die()  { printf '\033[31m%s\033[0m\n' "$1" >&2; exit 1; }

# ------------------------------------------------------------------- python
# numpy 2.1, pandas 2.2, and scikit-learn 1.5 publish wheels up to Python 3.13.
step "Finding a Python the backend supports (3.11 to 3.13)"
PYBIN=""
for candidate in python3.13 python3.12 python3.11 \
                 /opt/homebrew/bin/python3.13 /opt/homebrew/bin/python3.12 /opt/homebrew/bin/python3.11 \
                 /usr/local/bin/python3.13 /usr/local/bin/python3.12 /usr/local/bin/python3.11; do
  if command -v "$candidate" >/dev/null 2>&1; then PYBIN="$(command -v "$candidate")"; break; fi
done
if [ -x "$BACKEND/venv/bin/python" ]; then
  echo "  backend/venv already exists ($("$BACKEND/venv/bin/python" --version))"
elif [ -z "$PYBIN" ]; then
  die "No Python 3.11, 3.12, or 3.13 found. Install one with:  brew install python@3.13   then run this again."
else
  echo "  using $PYBIN ($("$PYBIN" --version))"
fi

# --------------------------------------------------------------- postgresql
step "Finding PostgreSQL"
PGBIN=""
if command -v pg_isready >/dev/null 2>&1; then
  PGBIN="$(dirname "$(command -v pg_isready)")"
else
  for dir in /opt/homebrew/opt/postgresql@*/bin /usr/local/opt/postgresql@*/bin /opt/homebrew/opt/postgresql/bin \
             /Applications/Postgres.app/Contents/Versions/latest/bin; do
    if [ -x "$dir/pg_isready" ]; then PGBIN="$dir"; fi
  done
fi
[ -n "$PGBIN" ] || die "PostgreSQL isn't installed. Install and start it with:
  brew install postgresql@16 && brew services start postgresql@16
then run this again."
echo "  found $("$PGBIN/psql" --version)"
if ! "$PGBIN/pg_isready" -q -h localhost -p 5432; then
  die "PostgreSQL is installed but not accepting connections on localhost:5432. Start it with:
  brew services start $(basename "$(dirname "$PGBIN")")
then run this again."
fi
echo "  accepting connections on localhost:5432"

if "$PGBIN/psql" -h localhost -lqt 2>/dev/null | cut -d '|' -f 1 | grep -qw "$DB_NAME"; then
  echo "  database $DB_NAME exists"
else
  "$PGBIN/createdb" -h localhost "$DB_NAME"
  echo "  created database $DB_NAME"
fi

# --------------------------------------------------------------- backend venv
step "The backend's environment"
if [ ! -x "$BACKEND/venv/bin/python" ]; then
  "$PYBIN" -m venv "$BACKEND/venv"
  echo "  created backend/venv"
fi
"$BACKEND/venv/bin/python" -m pip install --quiet --upgrade pip
"$BACKEND/venv/bin/python" -m pip install --quiet -r "$BACKEND/requirements.txt"
echo "  installed requirements.txt into backend/venv"

# ------------------------------------------------------------------ frontend
step "The frontend's packages"
if [ -d "$FRONTEND/node_modules" ]; then
  echo "  frontend/node_modules exists"
else
  (cd "$FRONTEND" && npm ci)
fi

step "Ready"
echo "  Next: ./scripts/refresh-demo.sh --no-deploy --yes"
