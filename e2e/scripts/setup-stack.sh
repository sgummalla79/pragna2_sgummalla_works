#!/usr/bin/env bash
# Spin up the full e2e stack: throwaway Postgres, BE (local-auth strategy),
# FE dev server (with the auth-strategy patch applied), register a test
# user, seed a flow-eligible model.
#
# Idempotent on re-run (re-creates the container, re-applies the patch).
# Companion: scripts/teardown-stack.sh.
set -euo pipefail

cd "$(dirname "$0")/.."
HERE="$PWD"

BE_REPO="${E2E_BE_REPO:-/Users/sgummalla/Desktop/work/repos/pragna2-api}"
FE_REPO="${E2E_FE_REPO:-/Users/sgummalla/Desktop/work/repos/pragna2_sgummalla_works}"
PG_NAME="${E2E_PG_CONTAINER:-pragna-vfe-browser}"
DB_NAME="${E2E_PG_DB:-pragna_it}"
PG_PORT="${E2E_PG_PORT:-5433}"
BE_PORT="${E2E_BE_PORT:-8000}"
FE_PORT="${E2E_FE_PORT:-5173}"

step() { printf "\n\033[1;34m▶ %s\033[0m\n" "$*"; }
fatal() { printf "\033[1;31m✖ %s\033[0m\n" "$*"; exit 1; }

# ── 1. Fresh isolated Postgres ────────────────────────────────────────
step "1. Fresh isolated Postgres on :$PG_PORT (NOT touching pragna-local-db on :5432)"
docker rm -f "$PG_NAME" >/dev/null 2>&1 || true
docker run -d --name "$PG_NAME" \
  -p "$PG_PORT:5432" \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB="$DB_NAME" \
  postgres:16-alpine >/dev/null
for i in $(seq 1 15); do
  if docker exec "$PG_NAME" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done

# ── 2. Migrations ─────────────────────────────────────────────────────
step "2. Applying BE migrations"
(
  cd "$BE_REPO"
  DATABASE_URL="postgresql+asyncpg://postgres:test@localhost:$PG_PORT/$DB_NAME" \
    uv run alembic upgrade head | tail -3
)

# ── 3. Boot BE ────────────────────────────────────────────────────────
step "3. Booting BE (local-auth) on :$BE_PORT"
pkill -f "uvicorn.*src.presentation" 2>/dev/null || true
sleep 1
JWT_SECRET="$(openssl rand -hex 32)"
ENCRYPTION_KEY="$(python3 -c "import secrets; print(secrets.token_hex(32))")"
(
  cd "$BE_REPO"
  DATABASE_URL="postgresql+asyncpg://postgres:test@localhost:$PG_PORT/$DB_NAME" \
    AUTH_STRATEGY=local APP_ENV=dev LOG_LEVEL=WARNING LOKI_URL= LOG_TO_FILE=false \
    JWT_SECRET="$JWT_SECRET" ENCRYPTION_KEY="$ENCRYPTION_KEY" \
    CORS_ORIGINS="http://localhost:$FE_PORT,http://localhost:3000" \
    nohup uv run uvicorn src.presentation.main:app --host 0.0.0.0 --port "$BE_PORT" \
      > /tmp/e2e_be.log 2>&1 & disown
)
for i in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$BE_PORT/health" 2>/dev/null || true)
  [ "$code" = "200" ] && break
  sleep 1
done
[ "$code" = "200" ] || fatal "BE didn't come up; see /tmp/e2e_be.log"

# ── 4. Register the test user ─────────────────────────────────────────
step "4. Registering test user"
USER_RESP=$(curl -s -X POST "http://localhost:$BE_PORT/api/users" \
  -H "Content-Type: application/json" \
  -d '{"email":"verify@example.com","name":"Verify","password":"VerifyTest123!"}')
USER_ID=$(printf "%s" "$USER_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
[ -n "$USER_ID" ] || fatal "user registration failed: $USER_RESP"
echo "user_id=$USER_ID"

# ── 5. Seed a flow-eligible model ─────────────────────────────────────
step "5. Seeding a flow-eligible user_model"
if [ -n "${E2E_ANTHROPIC_API_KEY:-}" ]; then
  # Real-key path — runtime tests that exercise Act / Assert against a
  # live LLM go through this branch. The ENCRYPTION_KEY env var must be
  # the same value the BE booted with (we set it in step 3), so the
  # encrypted blob seed-model.sh writes can be decrypted at LLM-call
  # time.
  ENCRYPTION_KEY="$ENCRYPTION_KEY" \
    bash "$HERE/scripts/seed-model.sh" "$USER_ID" "$E2E_ANTHROPIC_API_KEY"
else
  bash "$HERE/scripts/seed-model.sh" "$USER_ID"
fi

# ── 6. Apply the auth-strategy patch + boot FE ────────────────────────
step "6. Applying auth-strategy patch + booting FE on :$FE_PORT"
# Refuse only if the patch's target files are dirty (patching them again
# risks conflicts AND would lose the user's uncommitted edits on revert).
# Unrelated dirty paths are fine.
PATCH_TARGETS=(
  "src/presentation/providers/ServiceProvider.tsx"
  "src/presentation/providers/pickAuthRepo.ts"
  "src/__tests__/presentation/providers/pickAuthRepo.test.ts"
)
DIRTY=""
for f in "${PATCH_TARGETS[@]}"; do
  if [ -n "$(git -C "$FE_REPO" status --porcelain -- "$f")" ] || [ -e "$FE_REPO/$f" ] && ! git -C "$FE_REPO" ls-files --error-unmatch "$f" >/dev/null 2>&1 && [ "$f" != "src/presentation/providers/ServiceProvider.tsx" ]; then
    DIRTY="$DIRTY $f"
  fi
done
if [ -n "$DIRTY" ]; then
  fatal "patch-target files are dirty:$DIRTY — commit/stash/clean these first (teardown-stack.sh reverts them automatically after a normal run)."
fi
git -C "$FE_REPO" apply "$HERE/auth-strategy-switch.patch"

pkill -f vite 2>/dev/null || true
sleep 1
(
  cd "$FE_REPO"
  VITE_AUTH_STRATEGY=local nohup npm run dev > /tmp/e2e_fe.log 2>&1 & disown
)
for i in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$FE_PORT/" 2>/dev/null || true)
  [ "$code" = "200" ] && break
  sleep 1
done
[ "$code" = "200" ] || fatal "FE didn't come up; see /tmp/e2e_fe.log"

printf "\n\033[1;32m✔ Stack up.\033[0m  Run \`npm test\` from this dir to execute the suite.\n"
printf "   When done: \`npm run teardown\` (reverts patch, stops processes, removes container).\n\n"
