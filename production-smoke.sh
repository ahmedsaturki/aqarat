#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-https://aqarat-eg.vercel.app}"

request() {
  local path="$1"
  local expected="$2"
  local body_file
  body_file="$(mktemp)"
  local status
  status="$(curl --silent --show-error --max-time 20 --output "$body_file" --write-out '%{http_code}' "$BASE$path")"
  printf '%s status=%s expected=%s body=' "$path" "$status" "$expected"
  tr '\n' ' ' < "$body_file" | cut -c1-240
  printf '\n'
  rm -f "$body_file"
  if [[ "$status" != "$expected" ]]; then
    return 1
  fi
}

request /api/healthz 200
request /api/public-config 200
request /api/healthz/deep 401

printf '%s\n' 'security-headers:'
curl --silent --show-error --max-time 20 --dump-header - --output /dev/null "$BASE/api/healthz" \
  | grep -Ei '^(content-security-policy|strict-transport-security|x-content-type-options|x-frame-options|referrer-policy|x-correlation-id|cache-control|server-timing|x-response-time-ms):'
