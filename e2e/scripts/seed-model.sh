#!/usr/bin/env bash
# Seed a flow-eligible user_model so the editor's model dropdown isn't
# empty and Save validation passes. Bypasses encryption by inserting a
# dummy encrypted_api_key — the key is only decrypted at LLM-call time,
# which Save doesn't reach.
#
# Usage: seed-model.sh <user_uuid>
set -euo pipefail

USER_ID="${1:-}"
[ -n "$USER_ID" ] || { echo "usage: $0 <user_uuid>"; exit 2; }

PG_NAME="${E2E_PG_CONTAINER:-pragna-vfe-browser}"
DB_NAME="${E2E_PG_DB:-pragna_it}"
PROVIDER_API_NAME="${E2E_PROVIDER:-anthropic}"
MODEL_API_NAME="${E2E_MODEL:-claude-sonnet-4-6}"

ANTHROPIC_ID="$(docker exec "$PG_NAME" psql -U postgres -d "$DB_NAME" -tA -c \
  "SELECT id FROM llm_providers WHERE api_name='$PROVIDER_API_NAME'")"
[ -n "$ANTHROPIC_ID" ] || { echo "llm_provider '$PROVIDER_API_NAME' not seeded"; exit 1; }

docker exec "$PG_NAME" psql -U postgres -d "$DB_NAME" >/dev/null -c \
  "INSERT INTO user_providers (id, user_id, llm_provider_id, encrypted_api_key, enabled, archived, metadata)
   VALUES (gen_random_uuid(), '$USER_ID', '$ANTHROPIC_ID', 'dummy', true, false, '{}'::jsonb)"

UP_ID="$(docker exec "$PG_NAME" psql -U postgres -d "$DB_NAME" -tA -c \
  "SELECT id FROM user_providers WHERE user_id='$USER_ID' AND llm_provider_id='$ANTHROPIC_ID' LIMIT 1")"

docker exec "$PG_NAME" psql -U postgres -d "$DB_NAME" >/dev/null -c \
  "INSERT INTO user_models (id, user_id, user_provider_id, api_name, display_name, enabled, available_for_chat, available_for_flows, archived, metadata)
   VALUES (gen_random_uuid(), '$USER_ID', '$UP_ID', '$MODEL_API_NAME', 'Claude Sonnet 4.6 (test)', true, true, true, false, '{}'::jsonb)"

echo "seeded $MODEL_API_NAME for user $USER_ID"
