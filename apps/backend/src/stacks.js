export const STACKS_NETWORK = process.env.STACKS_NETWORK || 'testnet';
export const STACKS_API_BASE = process.env.STACKS_API_BASE || (STACKS_NETWORK === 'mainnet'
  ? 'https://api.mainnet.hiro.so'
  : 'https://api.testnet.hiro.so');
export const STACKS_RECIPIENT = process.env.STACKS_RECIPIENT || 'STX-DEMO-RECIPIENT';
export const STACKS_PAYMENT_ASSET = process.env.STACKS_PAYMENT_ASSET || 'USDCx';
export const STACKS_PAYMENT_CONTRACT = process.env.STACKS_PAYMENT_CONTRACT || '';
export const STACKS_PAYMENT_MEMO_PREFIX = process.env.STACKS_PAYMENT_MEMO_PREFIX || 'x402-autoscholar';

export function buildStacksPaymentRequest({ jobId, amount, asset }) {
  return {
    network: STACKS_NETWORK,
    apiBase: STACKS_API_BASE,
    recipient: STACKS_RECIPIENT,
    asset: asset || STACKS_PAYMENT_ASSET,
    amount,
    memo: `${STACKS_PAYMENT_MEMO_PREFIX}:${jobId}`,
    contract: STACKS_PAYMENT_CONTRACT || null,
    explorerUrl: STACKS_NETWORK === 'mainnet'
      ? 'https://explorer.hiro.so'
      : 'https://explorer.hiro.so/?chain=testnet'
  };
}

export async function verifyStacksPayment({ txid, sender, recipient, amount, asset, memo }) {
  if (!txid) {
    return { ok: false, reason: 'missing txid' };
  }

  // V7.0 scaffold: real chain verification hook.
  // Next step after wallet/contract details are provided:
  // 1. fetch tx details from Hiro API / stacks node
  // 2. verify sender, recipient, amount, memo, asset/contract
  // 3. ensure tx status is success and not replayed
  // 4. return canonical verification result
  return {
    ok: txid === 'demo-stacks-txid',
    mode: txid === 'demo-stacks-txid' ? 'demo-verification' : 'unverified',
    txid,
    sender: sender || null,
    recipient: recipient || STACKS_RECIPIENT,
    amount,
    asset,
    memo: memo || null,
    chain: STACKS_NETWORK,
    apiBase: STACKS_API_BASE,
    reason: txid === 'demo-stacks-txid' ? null : 'real verification not configured yet'
  };
}
