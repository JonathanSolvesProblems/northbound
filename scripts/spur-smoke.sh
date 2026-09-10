#!/usr/bin/env bash
# Run this the moment SPUR credits activate:  bash scripts/spur-smoke.sh
# Expects .env in the repo root. Confirms auth, credit, and that GLM 5.2 answers.
set -uo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

echo "endpoint : $SPUR_BASE_URL"
echo "model    : $SPUR_MODEL"
echo "key      : ${SPUR_API_KEY:0:12}..."
echo

code=$(curl -s -m 40 "$SPUR_BASE_URL/chat/completions" \
  -H "Authorization: Bearer $SPUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"$SPUR_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with the single word: ok\"}],\"max_tokens\":10}" \
  -o /tmp/spur_smoke.json -w '%{http_code}')

echo "HTTP $code"
cat /tmp/spur_smoke.json; echo

case "$code" in
  200) echo; echo "READY. Credits are live, GLM 5.2 is answering." ;;
  402) echo; echo "STILL UNFUNDED. Key is valid, credits not activated yet." ;;
  401) echo; echo "AUTH FAILED. Key is wrong or revoked." ;;
  404) echo; echo "MODEL NOT FOUND. Check the id against GET $SPUR_BASE_URL/models." ;;
  *)   echo; echo "Unexpected status. Read the body above." ;;
esac
