#!/usr/bin/env bash
set -euo pipefail

if [[ $# -gt 1 ]]; then
  echo "usage: ./verify-url.sh [base-url]" >&2
  exit 2
fi

if [[ $# -eq 1 ]]; then
  node scripts/verify-url.mjs "$1"
  exit
fi

npm run build:site >/dev/null
node scripts/serve-site.mjs &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
for _ in {1..40}; do
  if curl --fail --silent http://127.0.0.1:4173/ >/dev/null; then
    break
  fi
  sleep 0.1
done
node scripts/verify-url.mjs http://127.0.0.1:4173
