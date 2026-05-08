#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_dir="${CODEX_PROJECT_DIR:-$(cd "$script_dir/../.." && pwd)}"
state_file="$project_dir/.codex/.needs-review"
snapshot_file="$project_dir/.codex/.review-snapshot"

is_code_file() {
  case "$1" in
    *.md|*.txt|*.json|*.yaml|*.yml|*.toml|*.lock|*.log|*.env|*.env.*|*.gitignore|*.prettierrc|*.eslintrc|.codex/.needs-review|*/.codex/.needs-review)
      return 1
      ;;
    .codex/*|.agents/skills/*/SKILL.md)
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

input="$(cat || true)"
file_path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)"

if [ -n "$file_path" ]; then
  if is_code_file "$file_path"; then
    printf 'needs_review\n' > "$state_file"
  fi
  exit 0
fi

if [ -d "$project_dir/.git" ] && git -C "$project_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  while IFS= read -r changed; do
    if [ -n "$changed" ] && is_code_file "$changed"; then
      printf 'needs_review\n' > "$state_file"
      exit 0
    fi
  done <<EOF
$(git -C "$project_dir" diff --name-only HEAD 2>/dev/null || true)
EOF
fi

snapshot_current() {
  find "$project_dir" \
    \( -path "$project_dir/.git" -o -path "$project_dir/.codex" -o -path "$project_dir/.agents" -o -path "$project_dir/node_modules" -o -path "$project_dir/dist" -o -path "$project_dir/build" -o -path "$project_dir/.next" \) -prune \
    -o -type f -print 2>/dev/null |
    while IFS= read -r file; do
      rel="${file#$project_dir/}"
      if is_code_file "$rel"; then
        stat -f '%m %z' "$file" 2>/dev/null | awk -v p="$rel" '{print p "|" $1 "|" $2}'
      fi
    done | sort
}

tmp_snapshot="$(mktemp "${TMPDIR:-/tmp}/codex-review-snapshot.XXXXXX")"
snapshot_current > "$tmp_snapshot"

if [ -f "$state_file" ] && [ "$(tr -d '[:space:]' < "$state_file" 2>/dev/null || true)" = "clean" ]; then
  cp "$tmp_snapshot" "$snapshot_file"
  rm -f "$tmp_snapshot"
  exit 0
fi

if [ ! -f "$snapshot_file" ]; then
  cp "$tmp_snapshot" "$snapshot_file"
  rm -f "$tmp_snapshot"
  exit 0
fi

if ! cmp -s "$snapshot_file" "$tmp_snapshot"; then
  printf 'needs_review\n' > "$state_file"
fi

rm -f "$tmp_snapshot"

exit 0
