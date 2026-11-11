#!/usr/bin/env bash
#
# Point the demo's old address at its new one. Run once.
#
# The demo used to be its own Cloudflare Pages project at
# https://analytics.ryansansbury.com. It now lives at
# https://www.ryansansbury.com/analytics-dashboard/ beside the site's other
# demos. This replaces the old project's site with a single redirect rule, so
# every old link lands on the same page at the new address. A visit to
# analytics.ryansansbury.com/revenue goes
# to www.ryansansbury.com/analytics-dashboard/revenue.
#
# Run it after the website's deploy has put the demo live, so the redirect
# never points at a page that isn't there yet.
#
#   ./scripts/retire-subdomain.sh

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$REPO/scripts/out/retired-subdomain"
PROJECT="analytics-dashboard"
OLD_URL="https://analytics.ryansansbury.com"
NEW_URL="https://www.ryansansbury.com/analytics-dashboard"

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
die()  { printf '\033[31merror: %s\033[0m\n' "$1" >&2; exit 1; }

command -v wrangler >/dev/null || die "wrangler is not installed (brew install cloudflare-wrangler2)"

step "Checking the demo is live at its new address first"
code=$(curl -s -o /dev/null -w '%{http_code}' -m 20 "$NEW_URL/" || echo 000)
[ "$code" = "200" ] || die "$NEW_URL/ returned $code. Deploy the website before retiring the old address"
echo "  $NEW_URL/ is live"

step "Building the redirect"
rm -rf "$OUT"
mkdir -p "$OUT"
# :splat carries the rest of the path, so /revenue lands on /revenue and the
# bare address lands on the demo's front page.
printf '/*  %s/:splat  301\n' "$NEW_URL" > "$OUT/_redirects"
# Pages wants at least one page to publish. Nobody sees it, since the rule
# answers every path first, but it says where the demo went if anything ever does.
cat > "$OUT/index.html" <<HTML
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>The Analytics Dashboard has moved</title>
<meta http-equiv="refresh" content="0; url=$NEW_URL/">
<p>The Analytics Dashboard has moved to <a href="$NEW_URL/">$NEW_URL/</a>.</p>
</html>
HTML
echo "  every path on $OLD_URL goes to the same path under $NEW_URL/"

step "Publishing it to the old Pages project ($PROJECT)"
wrangler pages deploy "$OUT" --project-name "$PROJECT" --branch main --commit-dirty=true

step "Checking the old address"
for path in / /revenue; do
  moved=""
  for attempt in 1 2 3 4 5 6; do
    moved=$(curl -sI -m 20 "$OLD_URL$path?check=$RANDOM" | tr -d '\r' | awk 'tolower($1)=="location:" {print $2}')
    case "$moved" in "$NEW_URL$path"*) break ;; esac
    sleep 5
  done
  case "$moved" in
    "$NEW_URL$path"*) printf '  %-10s -> %s\n' "$path" "$moved" ;;
    *) die "$OLD_URL$path does not redirect yet (got '$moved'). Give it a minute and run this again" ;;
  esac
done

step "The old address now redirects to $NEW_URL/"
