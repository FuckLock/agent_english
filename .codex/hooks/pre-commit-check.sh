#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_dir="${CODEX_PROJECT_DIR:-$(cd "$script_dir/../.." && pwd)}"
tsconfig="$(find "$project_dir" -maxdepth 3 -name tsconfig.json -not -path '*/node_modules/*' -not -path '*/.next/*' 2>/dev/null | head -1)"

if [ -z "$tsconfig" ]; then
  exit 0
fi

project_code="$(dirname "$tsconfig")"
cd "$project_code"

if ! output="$(npx tsc --noEmit 2>&1)"; then
  printf 'TypeScript check failed; commit should be blocked.\n%s\n' "$output" >&2
  exit 2
fi

exit 0
