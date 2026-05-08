#!/usr/bin/env bash
set -euo pipefail

for port in 3000 3001 4173 5173 8080; do
  pid="$(lsof -ti:"$port" 2>/dev/null || true)"
  if [ -n "$pid" ]; then
    kill -9 $pid 2>/dev/null || true
  fi
done

sleep 1
exit 0
