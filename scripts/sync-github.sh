#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BRANCH="main"
REMOTE="github"

echo "==> Fetching $REMOTE/$BRANCH..."
git fetch "$REMOTE" "$BRANCH"

# Check if already up to date
LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse "$REMOTE/$BRANCH")

if git merge-base --is-ancestor "$REMOTE_HASH" "$LOCAL_HASH" 2>/dev/null; then
  echo "Already up to date with $REMOTE/$BRANCH"
  exit 0
fi

echo "==> Squash merging $REMOTE/$BRANCH..."
if git merge --squash "$REMOTE/$BRANCH" --allow-unrelated-histories 2>/dev/null; then
  echo "No conflicts"
else
  echo "==> Auto-resolving conflicts (favoring $REMOTE)..."
  conflicted=$(git diff --name-only --diff-filter=U)
  if [[ -n "$conflicted" ]]; then
    echo "$conflicted" | while read -r f; do
      echo "  Resolving: $f"
    done
    git checkout --theirs $conflicted
    git add $conflicted
  fi
fi

# Only commit if there's something staged
if git diff --cached --quiet; then
  echo "Nothing to commit"
  exit 0
fi

COMMIT_MSG="chore: sync with ${REMOTE}/${BRANCH}"
echo "==> Committing: $COMMIT_MSG"
git commit -m "$COMMIT_MSG"

echo "==> Pushing to origin..."
git push origin "$BRANCH"

echo "Done"
