#!/usr/bin/env bash
# Reverse of setup-stack.sh: stop FE + BE, drop the throwaway Postgres
# container, revert the auth-strategy patch (so the FE working tree is
# clean again).
set -euo pipefail

FE_REPO="${E2E_FE_REPO:-/Users/sgummalla/Desktop/work/repos/pragna2_sgummalla_works}"
PG_NAME="${E2E_PG_CONTAINER:-pragna-vfe-browser}"

step() { printf "\n\033[1;34m▶ %s\033[0m\n" "$*"; }

step "Stopping FE + BE"
pkill -f vite 2>/dev/null && echo "  vite stopped" || echo "  (vite not running)"
pkill -f "uvicorn.*src.presentation" 2>/dev/null && echo "  uvicorn stopped" || echo "  (uvicorn not running)"

step "Removing throwaway Postgres container"
docker rm -f "$PG_NAME" >/dev/null 2>&1 && echo "  $PG_NAME removed" || echo "  (no $PG_NAME container)"

step "Reverting the auth-strategy patch in FE working tree"
# Revert the tracked file change…
git -C "$FE_REPO" checkout -- src/presentation/providers/ServiceProvider.tsx 2>/dev/null || true
# …and remove the untracked files the patch created.
rm -f "$FE_REPO/src/presentation/providers/pickAuthRepo.ts"
rm -f "$FE_REPO/src/__tests__/presentation/providers/pickAuthRepo.test.ts"
rmdir "$FE_REPO/src/__tests__/presentation/providers" 2>/dev/null || true

# Confirm clean.
if [ -z "$(git -C "$FE_REPO" status --porcelain)" ]; then
  printf "\n\033[1;32m✔ Teardown complete; FE working tree clean.\033[0m\n\n"
else
  printf "\n\033[1;33m⚠ FE working tree still has changes:\033[0m\n"
  git -C "$FE_REPO" status --short
fi
