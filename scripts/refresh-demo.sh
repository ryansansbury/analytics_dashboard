#!/usr/bin/env bash
#
# Regenerate the hosted demo and stage it into the website.
#
# The demo at https://www.ryansansbury.com/analytics-dashboard/ is a static
# snapshot of this application, taken against a real PostgreSQL database with
# real models. It does not break, but it does age: its data is frozen at the
# date it was taken, and the sidebar says so. This script re-takes it.
#
# The demo lives in a folder on the website beside the site's other demos, and
# the website's own deploy publishes it. This script builds it for that folder
# and copies it into the website's working tree. Nothing goes live until the
# site's ./deploy.sh runs.
#
# The seeder is deterministic (seed 42 across Faker, random, and numpy) but
# anchors its window to now minus two years, so a refresh reproduces the same
# dashboard re-dated to today rather than a different-looking one.
#
#   ./scripts/refresh-demo.sh                 reseed, snapshot, test, build, stage into the site
#   ./scripts/refresh-demo.sh --skip-reseed   re-snapshot the database as it stands
#   ./scripts/refresh-demo.sh --no-stage      everything except copying into the site
#   ./scripts/refresh-demo.sh --check-live    after the site's deploy, check the live demo
#
# Then publish it with the website: cd ~/projects/rs_site && ./deploy.sh
#
# The coverage test runs before anything is staged. It mounts every page under
# every date preset against the freshly written snapshot, so an endpoint the
# snapshot missed stops here rather than becoming a blank chart in production.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$REPO/backend"
FRONTEND="$REPO/frontend"
PY="$BACKEND/venv/bin/python"

# This project's database, deliberately NOT read from an ambient DATABASE_URL.
#
# A global DATABASE_URL is a common thing to have exported in a shell profile,
# and it will belong to whatever project put it there. Inheriting it would point
# a reseed at somebody else's database, which drops and recreates tables. Set
# ANALYTICS_DATABASE_URL to override this one on purpose.
: "${ANALYTICS_DATABASE_URL:=postgresql://localhost:5432/analytics_dashboard}"
export DATABASE_URL="$ANALYTICS_DATABASE_URL"

# The website's published folder. Set ANALYTICS_SITE_DIR to use another.
: "${ANALYTICS_SITE_DIR:=$HOME/projects/rs_site/v5}"
FOLDER="analytics-dashboard"
DEMO_URL="https://www.ryansansbury.com/$FOLDER"
HOME_URL="https://www.ryansansbury.com/"
OLD_URL="https://analytics.ryansansbury.com"

RESEED=1
STAGE=1
CHECK_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --skip-reseed) RESEED=0 ;;
    # --no-deploy is the old name, from when this script published the demo itself.
    --no-stage|--no-deploy) STAGE=0 ;;
    --check-live)  CHECK_ONLY=1 ;;
    # Staging publishes nothing, so nothing asks for confirmation. Kept so older commands still run.
    --yes|-y)      ;;
    # Prints the header block above, stopping at the first line that is not a
    # comment, so editing the header cannot desync the help text.
    -h|--help)     awk 'NR>2 && /^#/ {sub(/^# ?/,""); print; next} NR>2 {exit}' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "unknown option: $arg (try --help)" >&2; exit 2 ;;
  esac
done

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
die()  { printf '\033[31merror: %s\033[0m\n' "$1" >&2; exit 1; }

# ------------------------------------------------------------- live check
# Run after the website's deploy. A deploy that reports success and serves the
# previous snapshot is the failure worth catching, so this checks the data's
# date and not only the status codes.
check_live() {
  step "Checking the live demo at $DEMO_URL/"
  local path code failed=0
  for path in / /revenue /customers /operations /forecasting; do
    code=$(curl -s -o /dev/null -w '%{http_code}' -m 20 "$DEMO_URL$path" || echo 000)
    printf '  %-14s %s\n' "$path" "$code"
    [ "$code" = "200" ] || failed=1
  done
  [ "$failed" -eq 0 ] || die "a page of the demo did not load. Deep links need the rewrites in the site's v5/_redirects"

  # Cache-busted, so the check reads what the site serves now and not an edge copy.
  local expected live
  expected=$("$PY" -c "import json;print(json.load(open('$FRONTEND/public/data/manifest.json'))['snapshotDate'])")
  live=$(curl -s -m 20 "$DEMO_URL/data/manifest.json?check=$RANDOM$RANDOM" \
         | "$PY" -c "import json,sys;print(json.load(sys.stdin)['snapshotDate'])" 2>/dev/null || true)
  [ "$live" = "$expected" ] || die "the live demo has data as of '$live' but this snapshot is $expected"
  echo "  data as of     $live"

  # The demo runs under its own security policy, and the homepage keeps the site's.
  local demo_csp home_csp
  demo_csp=$(curl -sI -m 20 "$DEMO_URL/" | tr -d '\r' | grep -i '^content-security-policy:' || true)
  case "$demo_csp" in
    *"connect-src 'self'"*) echo "  demo policy    its own" ;;
    *) die "the demo is not under its own security policy. Check its rule in the site's v5/_headers" ;;
  esac
  home_csp=$(curl -sI -m 20 "$HOME_URL" | tr -d '\r' | grep -i '^content-security-policy:' || true)
  case "$home_csp" in
    *cloudflareinsights*) echo "  site policy    unchanged on the homepage" ;;
    *) die "the homepage lost the site's security policy. The demo's rule must sit below the site's own" ;;
  esac

  # Once retired, the old address sends every path to the same page here.
  local moved
  moved=$(curl -sI -m 20 "$OLD_URL/revenue" | tr -d '\r' | awk 'tolower($1)=="location:" {print $2}')
  if [ "$moved" = "$DEMO_URL/revenue" ]; then
    echo "  old address    redirects here"
  else
    echo "  old address    still serves its own copy. Run ./scripts/retire-subdomain.sh to point it here"
  fi

  step "Live at $DEMO_URL/"
}

if [ "$CHECK_ONLY" -eq 1 ]; then
  [ -x "$PY" ] || die "no virtualenv at $PY"
  check_live
  exit 0
fi

# ---------------------------------------------------------------- preflight
# Checked up front so a missing tool fails in two seconds rather than after a
# four minute reseed.
step "Checking prerequisites"

[ -x "$PY" ] || die "no virtualenv at $PY. Run ./scripts/setup-local.sh"
command -v node >/dev/null    || die "node is not installed"
[ -d "$FRONTEND/node_modules" ] || die "frontend dependencies are missing. Run ./scripts/setup-local.sh"
if [ "$STAGE" -eq 1 ]; then
  [ -f "$ANALYTICS_SITE_DIR/index.html" ] || die "no website at $ANALYTICS_SITE_DIR. Set ANALYTICS_SITE_DIR to the site's published folder, or run with --no-stage"
fi

"$PY" - <<'PY' || die "cannot reach the database. Is PostgreSQL running?"
import os, sys
import psycopg2
try:
    psycopg2.connect(os.environ["DATABASE_URL"]).close()
except Exception as exc:
    print(f"  {exc}".rstrip(), file=sys.stderr)
    sys.exit(1)
PY
echo "  database reachable"
echo "  toolchain present"

# ------------------------------------------------------------------- reseed
if [ "$RESEED" -eq 1 ]; then
  step "Reseeding the database (this is the slow part, about a minute)"
  (cd "$BACKEND" && "$PY" reseed.py)
else
  step "Skipping reseed, snapshotting the database as it stands"
fi

# ----------------------------------------------------------------- snapshot
step "Snapshotting every endpoint"
(cd "$BACKEND" && "$PY" scripts/snapshot.py)

# --------------------------------------------------------------------- gate
# The release gate. A snapshot that does not cover the app must not ship.
step "Verifying the snapshot covers every request the pages make"
(cd "$FRONTEND" && npx vitest run src/services/staticData.test.tsx --reporter=dot) \
  || die "the snapshot does not cover the app. Nothing was staged. Add the missing paths to endpoints_for() in backend/scripts/snapshot.py"

# -------------------------------------------------------------------- build
# build:static sets VITE_STATIC_DATA, and vite.config.ts bases a static build
# at /analytics-dashboard/, so every asset, route, and data file is found in
# the site's folder.
step "Building the static bundle for /$FOLDER/"
(cd "$FRONTEND" && npm run build:static)
grep -q "/$FOLDER/assets/" "$FRONTEND/dist/index.html" \
  || die "the build is not based at /$FOLDER/, so its asset paths would point at the site's root"

SNAPSHOT_DATE=$("$PY" -c "import json;print(json.load(open('$FRONTEND/public/data/manifest.json'))['snapshotDate'])")
FILES=$(find "$FRONTEND/dist/data" -name '*.json' | wc -l | tr -d ' ')
echo "  snapshot date : $SNAPSHOT_DATE"
echo "  data files    : $FILES"

if [ "$STAGE" -eq 0 ]; then
  step "Done, not staged"
  echo "  Preview it with: (cd frontend && VITE_STATIC_DATA=true npx vite preview --port 4455)"
  echo "  then open http://localhost:4455/$FOLDER/"
  exit 0
fi

# -------------------------------------------------------------------- stage
# The folder is build output, replaced whole on every refresh so no file from
# an older build lingers beside the new one.
DEST="$ANALYTICS_SITE_DIR/$FOLDER"
step "Staging into the website at $DEST"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$FRONTEND/dist/." "$DEST/"
echo "  copied $(find "$DEST" -type f | wc -l | tr -d ' ') files"

step "Staged, not live yet"
echo "  Publish it with the website:  cd $(dirname "$ANALYTICS_SITE_DIR") && ./deploy.sh"
echo "  Then check it:                ./scripts/refresh-demo.sh --check-live"
