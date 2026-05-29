#!/usr/bin/env bash
# Seed a flow-eligible user_model so the editor's model dropdown isn't
# empty and Save validation passes.
#
# Two modes:
#   (a) dummy-key (default) — `encrypted_api_key = 'dummy'`. Save / Validate
#       reach the editor fine, but any LLM call returns 401. Used by
#       authoring-only tests.
#   (b) real-key (when arg #2 is set) — encrypts the provided API key with
#       the BE's AESCipher using the current $ENCRYPTION_KEY env var, so a
#       runtime LLM call goes through end-to-end. Used by full-stack tests
#       that exercise Act / Assert against a real provider.
#
# Usage:
#   seed-model.sh <user_uuid>              # mode (a)
#   seed-model.sh <user_uuid> <api_key>    # mode (b) — requires ENCRYPTION_KEY
set -euo pipefail

USER_ID="${1:-}"
REAL_API_KEY="${2:-}"
[ -n "$USER_ID" ] || { echo "usage: $0 <user_uuid> [<api_key>]"; exit 2; }

PG_NAME="${E2E_PG_CONTAINER:-pragna-vfe-browser}"
DB_NAME="${E2E_PG_DB:-pragna_it}"
PROVIDER_API_NAME="${E2E_PROVIDER:-anthropic}"
MODEL_API_NAME="${E2E_MODEL:-claude-sonnet-4-6}"
BE_REPO="${E2E_BE_REPO:-/Users/sgummalla/Desktop/work/repos/pragna2-api}"

# ── Compute the value stored in user_providers.encrypted_api_key ────────
if [ -n "$REAL_API_KEY" ]; then
  [ -n "${ENCRYPTION_KEY:-}" ] || {
    echo "ENCRYPTION_KEY env var is required when a real API key is provided"
    exit 1
  }
  # Use the BE's exact AESCipher so the runtime decrypt path resolves
  # correctly. ENCRYPTION_KEY is a 64-char hex string → 32 raw bytes.
  ENCRYPTED_KEY=$(cd "$BE_REPO" && uv run python -c "
import os, sys
from src.infrastructure.crypto.aes_cipher import AESCipher
key_bytes = bytes.fromhex(os.environ['ENCRYPTION_KEY'])
print(AESCipher(key_bytes).encrypt(sys.argv[1]))
" "$REAL_API_KEY")
  KEY_LABEL="real (encrypted)"
else
  ENCRYPTED_KEY="dummy"
  KEY_LABEL="dummy (LLM calls will 401)"
fi

# ── Resolve provider FK ────────────────────────────────────────────────
PROVIDER_ID="$(docker exec "$PG_NAME" psql -U postgres -d "$DB_NAME" -tA -c \
  "SELECT id FROM llm_providers WHERE api_name='$PROVIDER_API_NAME'")"
[ -n "$PROVIDER_ID" ] || { echo "llm_provider '$PROVIDER_API_NAME' not seeded"; exit 1; }

# ── Insert user_provider with the chosen encrypted_api_key ──────────────
docker exec "$PG_NAME" psql -U postgres -d "$DB_NAME" >/dev/null -c \
  "INSERT INTO user_providers (id, user_id, llm_provider_id, encrypted_api_key, enabled, archived, metadata)
   VALUES (gen_random_uuid(), '$USER_ID', '$PROVIDER_ID', '$ENCRYPTED_KEY', true, false, '{}'::jsonb)"

UP_ID="$(docker exec "$PG_NAME" psql -U postgres -d "$DB_NAME" -tA -c \
  "SELECT id FROM user_providers WHERE user_id='$USER_ID' AND llm_provider_id='$PROVIDER_ID' LIMIT 1")"

# ── Insert the user_model, enabled for both chat and flows ──────────────
docker exec "$PG_NAME" psql -U postgres -d "$DB_NAME" >/dev/null -c \
  "INSERT INTO user_models (id, user_id, user_provider_id, api_name, display_name, enabled, available_for_chat, available_for_flows, archived, metadata)
   VALUES (gen_random_uuid(), '$USER_ID', '$UP_ID', '$MODEL_API_NAME', 'Claude Sonnet 4.6 (test)', true, true, true, false, '{}'::jsonb)"

echo "seeded $MODEL_API_NAME for user $USER_ID — key: $KEY_LABEL"
