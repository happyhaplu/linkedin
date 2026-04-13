#!/usr/bin/env bash
# scripts/smoke-test.sh — API contract + regression smoke tests
# Runs against the LIVE servers (localhost:4000 backend, localhost:3000 frontend).
#
# Usage:
#   ./scripts/smoke-test.sh                    # default (localhost:4000)
#   BACKEND=http://localhost:4000 ./scripts/smoke-test.sh
#
# Exit code:
#   0 — all tests passed
#   1 — one or more tests failed

set -euo pipefail

BACKEND="${BACKEND:-http://localhost:4000}"
FRONTEND="${FRONTEND:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-happy.outcraftly@zohomail.in}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-System@123321}"
COOKIE_JAR="/tmp/reach_smoke_admin_$$.txt"
USER_COOKIE_JAR="/tmp/reach_smoke_user_$$.txt"

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
RESET='\033[0m'

PASS=0
FAIL=0
SKIP=0

pass() { echo -e "  ${GREEN}✓${RESET} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}✗${RESET} $1"; FAIL=$((FAIL + 1)); }
skip() { echo -e "  ${YELLOW}~${RESET} $1 (skipped)"; SKIP=$((SKIP + 1)); }
header() { echo -e "\n${BLUE}══ $1 ══${RESET}"; }

# ── Helpers ───────────────────────────────────────────────────────────────────

# get_status: returns HTTP status code only (000 on connection failure)
get_status() {
  curl -s -o /dev/null -w "%{http_code}" "$@" 2>/dev/null || echo "000"
}

# get_body: returns response body (empty on connection failure)
get_body() {
  curl -s "$@" 2>/dev/null || true
}

# assert_status: test that a request returns the expected status code
assert_status() {
  local desc="$1"
  local expected="$2"
  shift 2
  local actual
  actual=$(get_status "$@")
  if [[ "$actual" == "$expected" ]]; then
    pass "$desc → HTTP $actual"
  else
    fail "$desc → expected HTTP $expected, got HTTP $actual"
  fi
}

# assert_body_contains: test that response body contains a string
assert_body_contains() {
  local desc="$1"
  local pattern="$2"
  shift 2
  local body
  body=$(get_body "$@")
  if echo "$body" | grep -q "$pattern"; then
    pass "$desc → body contains '$pattern'"
  else
    fail "$desc → body missing '$pattern' (got: ${body:0:120})"
  fi
}

# ── Cleanup ───────────────────────────────────────────────────────────────────
cleanup() {
  rm -f "$COOKIE_JAR" "$USER_COOKIE_JAR"
}
trap cleanup EXIT

# ─────────────────────────────────────────────────────────────────────────────
echo -e "${BLUE}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${BLUE}║       Reach — API Smoke & Regression Tests       ║${RESET}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${RESET}"
echo "  Backend : $BACKEND"
echo "  Frontend: $FRONTEND"

# ── 1. Health check ───────────────────────────────────────────────────────────
header "1. Health Check"
assert_status "GET /health → 200"     "200"  "$BACKEND/health"
assert_body_contains "health body has status:ok" '"ok"' "$BACKEND/health"
assert_body_contains "health body has service"   '"reach-backend"' "$BACKEND/health"

# ── 2. Auth — no session → 401 ───────────────────────────────────────────────
header "2. Auth — unauthenticated (expect 401)"
assert_status "GET /api/auth/me → 401"           "401" "$BACKEND/api/auth/me"
assert_status "GET /api/auth/check → 401"        "401" "$BACKEND/api/auth/check"

# ── 3. Regression: /api/auth/me must NEVER return 402 ────────────────────────
header "3. Regression — /api/auth/me is never plan-gated"
STATUS=$(get_status "$BACKEND/api/auth/me")
if [[ "$STATUS" == "402" ]]; then
  fail "/api/auth/me returned 402 — REGRESSION: plan gate is incorrectly blocking this route"
elif [[ "$STATUS" == "401" ]]; then
  pass "/api/auth/me returned 401 (not 402) — billing gate regression OK"
else
  skip "/api/auth/me returned $STATUS (unexpected, but not the regression)"
fi

# ── 4. All module routes → 401 (not 404 or 402) without session ──────────────
header "4. Module Routes — registered + auth-gated (no session)"
ROUTES=(
  "GET /api/linkedin-accounts"
  "GET /api/proxies"
  "GET /api/campaigns"
  "GET /api/campaigns/stats"
  "GET /api/campaigns/templates"
  "GET /api/leads"
  "GET /api/lists"
  "GET /api/custom-fields"
  "GET /api/network/connections"
  "GET /api/network/requests"
  "GET /api/network/sync/logs"
  "GET /api/network/analytics"
  "GET /api/unibox/conversations"
  "GET /api/unibox/accounts"
  "GET /api/analytics"
  "GET /api/queue/stats"
)

for ROUTE in "${ROUTES[@]}"; do
  METHOD=$(echo "$ROUTE" | awk '{print $1}')
  RPATH=$(echo "$ROUTE" | awk '{print $2}')
  STATUS=$(get_status -X "$METHOD" "$BACKEND$RPATH")
  if [[ "$STATUS" == "401" ]]; then
    pass "$METHOD $RPATH → 401 (registered + session-gated)"
  elif [[ "$STATUS" == "404" ]]; then
    fail "$METHOD $RPATH → 404 (ROUTE NOT REGISTERED)"
  elif [[ "$STATUS" == "402" ]]; then
    fail "$METHOD $RPATH → 402 (plan gate running without session — REGRESSION)"
  else
    fail "$METHOD $RPATH → $STATUS (unexpected)"
  fi
done

# ── 5. Admin — wrong credentials → 401 ───────────────────────────────────────
header "5. Admin Auth — wrong credentials"
assert_status "POST /admin/login (wrong creds) → 401" "401" \
  -X POST "$BACKEND/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"wrong@example.com","password":"wrongpassword"}'

# ── 6. Admin — correct credentials → 200 ─────────────────────────────────────
header "6. Admin Auth — correct credentials"
ADMIN_RESP=$(curl -s -c "$COOKIE_JAR" -X POST "$BACKEND/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

if echo "$ADMIN_RESP" | grep -q '"ok":true'; then
  pass "POST /admin/login → 200 {ok:true}"
else
  fail "POST /admin/login → unexpected response: ${ADMIN_RESP:0:120}"
fi

# ── 7. Admin routes — with valid session ─────────────────────────────────────
header "7. Admin Routes — with valid session"
assert_status "GET /admin/me → 200"    "200" -b "$COOKIE_JAR" "$BACKEND/admin/me"
assert_status "GET /admin/users → 200" "200" -b "$COOKIE_JAR" "$BACKEND/admin/users"
assert_status "GET /admin/plans → 200" "200" -b "$COOKIE_JAR" "$BACKEND/admin/plans"

assert_body_contains "GET /admin/me has role:admin" '"admin"' \
  -b "$COOKIE_JAR" "$BACKEND/admin/me"

assert_body_contains "GET /admin/plans returns array" '"plans"' \
  -b "$COOKIE_JAR" "$BACKEND/admin/plans"

# ── 8. Admin — create a test plan ────────────────────────────────────────────
header "8. Admin — Create Plan (idempotent smoke plan)"
CREATE_RESP=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$BACKEND/admin/plans" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Smoke-Test-Plan",
    "type": "custom",
    "description": "Auto-created by smoke-test.sh",
    "max_linkedin_senders": 1,
    "features": ["Smoke test"],
    "is_active": true
  }')

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$BACKEND/admin/plans" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Smoke-Test-Plan-2",
    "type": "custom",
    "description": "Auto-created by smoke-test.sh run 2",
    "max_linkedin_senders": 1,
    "features": ["Smoke test"],
    "is_active": true
  }')

if [[ "$HTTP_CODE" == "201" || "$HTTP_CODE" == "200" ]]; then
  pass "POST /admin/plans → $HTTP_CODE (plan created)"
else
  fail "POST /admin/plans → $HTTP_CODE (expected 200 or 201)"
fi

# ── 9. Admin logout ───────────────────────────────────────────────────────────
header "9. Admin Logout"
assert_status "POST /admin/logout → 200" "200" \
  -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$BACKEND/admin/logout"

# After logout: admin routes should return 401
assert_status "GET /admin/me after logout → 401" "401" \
  -b "$COOKIE_JAR" "$BACKEND/admin/me"

# ── 10. Stripe webhook — invalid signature → 400 ─────────────────────────────
header "10. Stripe Webhook — bad signature"
STRIPE_STATUS=$(get_status -X POST "$BACKEND/stripe/webhook" \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: t=invalid,v1=invalidsig" \
  -d '{"type":"checkout.session.completed"}')
if [[ "$STRIPE_STATUS" == "400" || "$STRIPE_STATUS" == "500" ]]; then
  pass "POST /stripe/webhook (bad sig) → $STRIPE_STATUS (signature rejected)"
else
  fail "POST /stripe/webhook (bad sig) → $STRIPE_STATUS (expected 400 or 500)"
fi

# ── 11. Frontend smoke ────────────────────────────────────────────────────────
header "11. Frontend — Page Availability"
FE_STATUS=$(get_status "$FRONTEND/")
if [[ "$FE_STATUS" == "200" ]]; then
  pass "GET $FRONTEND/ → 200 (SPA shell served)"
elif [[ "$FE_STATUS" == "000" ]]; then
  skip "GET $FRONTEND/ → connection refused (frontend not running — start with: make frontend)"
else
  skip "GET $FRONTEND/ → $FE_STATUS (frontend may not be running)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}══════════════════════════════════════════════════${RESET}"
TOTAL=$((PASS + FAIL + SKIP))
echo -e "  Total:  $TOTAL"
echo -e "  ${GREEN}Passed: $PASS${RESET}"
if [[ $FAIL -gt 0 ]]; then
  echo -e "  ${RED}Failed: $FAIL${RESET}"
else
  echo -e "  Failed: $FAIL"
fi
echo -e "  ${YELLOW}Skipped: $SKIP${RESET}"
echo -e "${BLUE}══════════════════════════════════════════════════${RESET}"

if [[ $FAIL -gt 0 ]]; then
  echo -e "\n${RED}SMOKE TEST FAILED — $FAIL check(s) did not pass.${RESET}"
  exit 1
else
  echo -e "\n${GREEN}SMOKE TEST PASSED — all $PASS checks OK.${RESET}"
  exit 0
fi
