#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_dir="${CODEX_PROJECT_DIR:-$(cd "$script_dir/../.." && pwd)}"
feedback_index="$project_dir/.codex/feedback/FEEDBACK-INDEX.md"

if [ ! -f "$feedback_index" ]; then
  exit 0
fi

count="$(grep -c '^- \[' "$feedback_index" 2>/dev/null || true)"
count="${count:-0}"

if [ "$count" -gt 0 ] 2>/dev/null; then
  printf 'Project has %s feedback record(s). Consider running evolution-engine when no higher-priority task is active.\n' "$count"
fi

exit 0
