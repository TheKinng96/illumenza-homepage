#!/usr/bin/env bash
# Which articles have not been re-checked against the admin recently?
#
# Articles document a UI that changes. This lists them oldest-first so a
# release can be followed by re-opening the screens that matter, rather than
# guessing which posts a change invalidated.
#
# Usage:
#   script/stale-check.sh            # list everything, oldest first
#   script/stale-check.sh 90         # only those older than 90 days
#   script/stale-check.sh --screen /redemption   # everything covering a screen
set -euo pipefail
cd "$(dirname "$0")/.."

today=$(date +%s)
days=0
want_screen=""

case "${1:-}" in
  --screen) want_screen="${2:?--screen needs a path}" ;;
  ''|*[!0-9]*) : ;;
  *) days="$1" ;;
esac

printf '%-12s %-26s %s\n' "VERIFIED" "SCREEN" "POST"
printf '%-12s %-26s %s\n' "--------" "------" "----"

for f in _posts/*.md; do
  v=$(sed -n 's/^verified: //p' "$f" | head -1)
  s=$(sed -n 's/^screen: //p' "$f" | head -1)
  slug=$(basename "$f" .md | sed -E 's/^[0-9]{4}-[0-9]{2}-[0-9]{2}-//')
  [ -z "$v" ] && v="(none)"
  [ -z "$s" ] && s="—"
  if [ -n "$want_screen" ] && [ "$s" != "$want_screen" ]; then continue; fi
  if [ "$v" != "(none)" ] && [ "$days" -gt 0 ]; then
    vs=$(date -j -f "%Y-%m-%d" "$v" +%s 2>/dev/null || date -d "$v" +%s)
    age=$(( (today - vs) / 86400 ))
    if [ "$age" -lt "$days" ]; then continue; fi
  fi
  printf '%-12s %-26s %s\n' "$v" "$s" "$slug"
done | sort
