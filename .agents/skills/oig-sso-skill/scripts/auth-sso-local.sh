#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
cd "$ROOT_DIR"

APP_URL="${1:-${PLAYWRIGHT_SSO_APP_URL:-http://localhost:3000/overview}}"
APP_ORIGIN="$(node -e 'console.log(new URL(process.argv[1]).origin)' "$APP_URL")"
APP_PORT="$(node -e 'const url = new URL(process.argv[1]); console.log(url.port || (url.protocol === "https:" ? "443" : "80"))' "$APP_URL")"
CREDENTIALS_PATH="${PLAYWRIGHT_SSO_CREDENTIALS:-playwright/.auth/sso-ai-login.local.json}"
SERVER_PID=""
LOGIN_PID=""
SERVER_LOG="/tmp/playwright-local-auth-${APP_PORT}.log"

export PLAYWRIGHT_SSO_APP_URL="$APP_URL"
export NO_PROXY="${NO_PROXY:+$NO_PROXY,}127.0.0.1,localhost"
export no_proxy="${no_proxy:+$no_proxy,}127.0.0.1,localhost"

cleanup() {
  if [[ -n "$LOGIN_PID" ]] && kill -0 "$LOGIN_PID" 2>/dev/null; then
    kill "$LOGIN_PID" 2>/dev/null || true
    wait "$LOGIN_PID" 2>/dev/null || true
  fi
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
  if [[ "${1:-}" != "force" ]]; then
    if [[ -n "${PLAYWRIGHT_SSO_ACCOUNT:-}" && -n "${PLAYWRIGHT_SSO_PASSWORD:-}" ]]; then
      return
    fi
    if CREDENTIALS_PATH="$CREDENTIALS_PATH" node <<'NODE'
const fs = require('node:fs');
try {
  const value = JSON.parse(fs.readFileSync(process.env.CREDENTIALS_PATH, 'utf8'));
  process.exit(typeof value.account === 'string' && value.account.trim() &&
    typeof value.password === 'string' && value.password ? 0 : 1);
} catch { process.exit(1); }
NODE
    then
      return
    fi
  fi

  if [[ ! -t 0 || ! -t 1 ]]; then
    echo "需要输入 SSO 账号密码，请在交互终端运行登录脚本。" >&2
    return 2
  fi

  unset PLAYWRIGHT_SSO_ACCOUNT PLAYWRIGHT_SSO_PASSWORD
  local account="" password=""
  until [[ -n "$account" && -n "$password" ]]; do
    read -r -p "SSO 账号: " account
    read -rs -p "SSO 密码: " password
    echo
    if [[ -z "$account" || -z "$password" ]]; then
      echo "账号和密码不能为空，请重新输入。" >&2
    fi
  done

  umask 077
  mkdir -p "$(dirname "$CREDENTIALS_PATH")"
  CREDENTIALS_PATH="$CREDENTIALS_PATH" SSO_ACCOUNT="$account" SSO_PASSWORD="$password" node <<'NODE'
const fs = require('node:fs');
const path = process.env.CREDENTIALS_PATH;
const account = process.env.SSO_ACCOUNT;
const password = process.env.SSO_PASSWORD;
fs.writeFileSync(path, `${JSON.stringify({ account, password }, null, 2)}\n`, { mode: 0o600 });
fs.chmodSync(path, 0o600);
NODE
  echo "SSO 账号配置已保存到本地。"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

ensure_credentials

if [[ "${PLAYWRIGHT_SSO_SESSION_ONLY:-}" == "1" ]]; then
  echo "正在生成真实开发会话。"
elif is_http_ready; then
  echo "Using existing local app at $APP_ORIGIN"
else
  echo "Starting local app at $APP_ORIGIN"
  PLAYWRIGHT_SSO_LOGIN_IN_PROGRESS=1 pnpm run dev --host 127.0.0.1 --port "$APP_PORT" --strictPort >"$SERVER_LOG" 2>&1 &
  SERVER_PID=$!
  wait_for_http "$APP_ORIGIN"
fi

while true; do
  node "$SCRIPT_DIR/record-auth.mjs" "$APP_URL" &
  LOGIN_PID=$!
  if wait "$LOGIN_PID"; then
    LOGIN_PID=""
    break
  else
    status=$?
    LOGIN_PID=""
    if [[ "$status" != "2" ]]; then
      exit "$status"
    fi
  fi
  echo "SSO 账号或密码校验未通过，请重新输入。" >&2
  ensure_credentials force
done
