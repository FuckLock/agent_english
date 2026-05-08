#!/usr/bin/env bash
set -euo pipefail

input="$(cat || true)"
exit_code="$(printf '%s' "$input" | jq -r '.tool_exit_code // .exit_code // "1"' 2>/dev/null || printf '1')"

if [ "$exit_code" = "0" ]; then
  git push 2>&1 || true
fi

exit 0
