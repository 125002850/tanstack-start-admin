#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DEFAULT_PORT="${PLAYWRIGHT_WORKSPACE_DEFAULT_PORT:-3099}"
ROLLBACK_PORT="${PLAYWRIGHT_WORKSPACE_ROLLBACK_PORT:-3100}"
DEFAULT_OUTPUT_DIR="$ROOT_DIR/.output-playwright-default"
ROLLBACK_OUTPUT_DIR="$ROOT_DIR/.output-playwright-rollback"

DEFAULT_PID=""
ROLLBACK_PID=""

cleanup() {
  local exit_code=$?

  if [[ -n "$DEFAULT_PID" ]] && kill -0 "$DEFAULT_PID" 2>/dev/null; then
    kill "$DEFAULT_PID" 2>/dev/null || true
  fi

  if [[ -n "$ROLLBACK_PID" ]] && kill -0 "$ROLLBACK_PID" 2>/dev/null; then
    kill "$ROLLBACK_PID" 2>/dev/null || true
  fi

  wait "$DEFAULT_PID" 2>/dev/null || true
  wait "$ROLLBACK_PID" 2>/dev/null || true

  exit "$exit_code"
}

wait_for_http() {
  local url="$1"
  local attempts=0

  until curl -fsS "$url" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if (( attempts >= 120 )); then
      echo "Timed out waiting for $url" >&2
      return 1
    fi
    sleep 1
  done
}

build_output() {
  local workspace_flag="$1"
  local target_dir="$2"

  rm -rf "$target_dir"
  if [[ "$workspace_flag" == "0" ]]; then
    VITE_ENABLE_WORKSPACE_TABS=0 pnpm run build
  else
    pnpm run build
  fi
  cp -R .output "$target_dir"
}

trap cleanup EXIT INT TERM

build_output "1" "$DEFAULT_OUTPUT_DIR"
build_output "0" "$ROLLBACK_OUTPUT_DIR"

(
  cd "$DEFAULT_OUTPUT_DIR"
  PORT="$DEFAULT_PORT" node server/index.mjs
) >/tmp/playwright-workspace-default.log 2>&1 &
DEFAULT_PID=$!
(
  cd "$ROLLBACK_OUTPUT_DIR"
  PORT="$ROLLBACK_PORT" node server/index.mjs
) >/tmp/playwright-workspace-rollback.log 2>&1 &
ROLLBACK_PID=$!

wait_for_http "http://127.0.0.1:${DEFAULT_PORT}/dashboard/product"
wait_for_http "http://127.0.0.1:${ROLLBACK_PORT}/dashboard/product"

# Keep the wrapper alive until Playwright stops it. If one server exits early,
# do not proactively tear down the sibling process for the other project.
wait "$DEFAULT_PID" "$ROLLBACK_PID"
