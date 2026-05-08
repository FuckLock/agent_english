#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_dir="${CODEX_PROJECT_DIR:-$(cd "$script_dir/../.." && pwd)}"
state_file="$project_dir/.codex/.needs-review"

if [ ! -f "$state_file" ]; then
  exit 0
fi

state="$(tr -d '[:space:]' < "$state_file" 2>/dev/null || true)"

case "$state" in
  needs_review)
    printf '%s\n' '{"decision":"block","reason":"Code changed but review is still pending. Run code-review or explicitly resolve the review gate, then write clean to .codex/.needs-review."}'
    exit 0
    ;;
  clean)
    rm -f "$state_file"
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
