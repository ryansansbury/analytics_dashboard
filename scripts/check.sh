#!/usr/bin/env bash
#
# Every check this repository has, run the way CI runs them.
#
#   ./scripts/check.sh
#
# The backend suite runs against a throwaway PostgreSQL database, created here
# when it's missing, so the cross-endpoint consistency tests run instead of
# skipping. Its name ends in _test because the fixtures drop every table and
# refuse any database that isn't named as disposable. Then the frontend's
# lint, tests, and type-checked production build.
#
# Set TEST_DATABASE_URL to use a different test database.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY="$REPO/backend/venv/bin/python"
: "${TEST_DATABASE_URL:=postgresql://localhost:5432/analytics_dashboard_test}"
export TEST_DATABASE_URL

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
die()  { printf '\033[31merror: %s\033[0m\n' "$1" >&2; exit 1; }

[ -x "$PY" ] || die "no virtualenv at backend/venv. Run ./scripts/setup-local.sh first"
[ -d "$REPO/frontend/node_modules" ] || die "frontend dependencies are missing. Run ./scripts/setup-local.sh first"

step "Test database"
TEST_DB="${TEST_DATABASE_URL##*/}"
if command -v createdb >/dev/null 2>&1; then
  createdb "$TEST_DB" 2>/dev/null && echo "  created $TEST_DB" || echo "  $TEST_DB is there"
else
  echo "  createdb isn't on the PATH, so the database has to exist already"
fi

step "Backend tests"
(cd "$REPO/backend" && "$PY" -m pytest tests/ -q -p no:cacheprovider)

step "Frontend lint"
(cd "$REPO/frontend" && npm run --silent lint)

step "Frontend tests"
(cd "$REPO/frontend" && npm test --silent)

step "Type-checked build"
(cd "$REPO/frontend" && npm run --silent build)

step "Every check passed"
