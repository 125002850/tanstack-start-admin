#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
cd "$ROOT_DIR"

APP_URL="${1:-${PLAYWRIGHT_SSO_APP_URL:-http://localhost:3000/dashboard/overview}}"
APP_ORIGIN="$(node -e 'console.log(new URL(process.argv[1]).origin)' "$APP_URL")"
APP_PORT="$(node -e 'const url = new URL(process.argv[1]); console.log(url.port || (url.protocol === "https:" ? "443" : "80"))' "$APP_URL")"
CREDENTIALS_PATH="${PLAYWRIGHT_SSO_CREDENTIALS:-playwright/.auth/sso-ai-login.local.json}"
SERVER_PID=""
SERVER_LOG="/tmp/playwright-local-auth-3000.log"

export PLAYWRIGHT_SSO_APP_URL="$APP_URL"
export NO_PROXY="${NO_PROXY:+$NO_PROXY,}127.0.0.1,localhost"
export no_proxy="${no_proxy:+$no_proxy,}127.0.0.1,localhost"

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}

is_http_ready() {
  curl --noproxy '*' -fsS "$APP_ORIGIN" >/dev/null 2>&1
}

wait_for_http() {
  local url="$1"
  local attempts=0

  until curl --noproxy '*' -fsS "$url" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if (( attempts >= 120 )); then
      echo "Timed out waiting for $url. See $SERVER_LOG" >&2
      return 1
    fi
    sleep 1
  done
}

ensure_credentials() {
  if [[ -n "${PLAYWRIGHT_SSO_ACCOUNT:-}" && -n "${PLAYWRIGHT_SSO_PASSWORD:-}" ]]; then
    return
  fi

  if [[ -f "$CREDENTIALS_PATH" ]]; then
    return
  fi

  echo "Missing SSO credentials file: $CREDENTIALS_PATH"
  read -r -p "SSO account: " account
  read -r -s -p "SSO password: " password
  echo

  if [[ -z "$account" || -z "$password" ]]; then
    echo "SSO account and password are required." >&2
    return 1
  fi

  mkdir -p "$(dirname "$CREDENTIALS_PATH")"
  CREDENTIALS_PATH="$CREDENTIALS_PATH" SSO_ACCOUNT="$account" SSO_PASSWORD="$password" node <<'NODE'
const fs = require('node:fs');
const path = process.env.CREDENTIALS_PATH;
const account = process.env.SSO_ACCOUNT;
const password = process.env.SSO_PASSWORD;
fs.writeFileSync(path, `${JSON.stringify({ account, password }, null, 2)}\n`, { mode: 0o600 });
NODE
  echo "Created local SSO credentials file: $CREDENTIALS_PATH"
}

trap cleanup EXIT INT TERM

ensure_credentials

if is_http_ready; then
  echo "Using existing local app at $APP_ORIGIN"
else
  echo "Starting local app at $APP_ORIGIN"
  pnpm run dev -- --host 127.0.0.1 --port "$APP_PORT" --strictPort >"$SERVER_LOG" 2>&1 &
  SERVER_PID=$!
  wait_for_http "$APP_ORIGIN"
fi

node "$SCRIPT_DIR/record-auth.mjs" "$APP_URL"
