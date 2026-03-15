#!/usr/bin/env bash
set -euo pipefail

if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

if ! command -v clarinet >/dev/null 2>&1; then
  echo "clarinet is required but was not found in PATH." >&2
  exit 1
fi

if [[ -z "${STACKS_DEPLOYER_MNEMONIC:-}" ]]; then
  read -r -s -p "Enter Stacks testnet mnemonic: " STACKS_DEPLOYER_MNEMONIC
  echo
fi

if [[ -z "${STACKS_DEPLOYER_MNEMONIC:-}" ]]; then
  echo "A deployer mnemonic is required." >&2
  exit 1
fi

STACKS_DEPLOYMENT_COST_STRATEGY="${STACKS_DEPLOYMENT_COST_STRATEGY:-manual}"
case "$STACKS_DEPLOYMENT_COST_STRATEGY" in
  low)
    COST_FLAG="--low-cost"
    ;;
  medium)
    COST_FLAG="--medium-cost"
    ;;
  high)
    COST_FLAG="--high-cost"
    ;;
  manual)
    COST_FLAG="--manual-cost"
    ;;
  *)
    echo "Invalid STACKS_DEPLOYMENT_COST_STRATEGY: $STACKS_DEPLOYMENT_COST_STRATEGY" >&2
    echo "Use one of: manual, low, medium, high" >&2
    exit 1
    ;;
esac

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$TMP_DIR/contracts" "$TMP_DIR/settings"
cp Clarinet.toml "$TMP_DIR/Clarinet.toml"
cp contracts/autoscholar-payments.clar "$TMP_DIR/contracts/autoscholar-payments.clar"
chmod 700 "$TMP_DIR"

cat > "$TMP_DIR/settings/Testnet.toml" <<EOF
[network]
name = "testnet"
node_rpc_address = "https://api.testnet.hiro.so"
deployment_fee_rate = 10

[accounts.deployer]
mnemonic = "${STACKS_DEPLOYER_MNEMONIC}"
EOF
chmod 600 "$TMP_DIR/settings/Testnet.toml"

echo "Generating deployment plan..."
clarinet deployments generate --testnet "$COST_FLAG" -m "$TMP_DIR/Clarinet.toml"

echo "Applying deployment plan to Stacks testnet..."
clarinet deployments apply --testnet -m "$TMP_DIR/Clarinet.toml" -d --no-dashboard

echo
echo "Deployment finished."
echo "Update your local .env with:"
echo "  STACKS_PAYMENT_CONTRACT=<deployer-address>.autoscholar-payments"
echo "  STACKS_RECIPIENT=<treasury-address>"
