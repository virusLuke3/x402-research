export const STACKS_NETWORK = 'testnet';
export const STACKS_API_BASE = process.env.STACKS_API_BASE || 'https://api.testnet.hiro.so';
export const STACKS_RECIPIENT = process.env.STACKS_RECIPIENT || 'ST2AUTOSCHOLARTESTNETTREASURY111111111111111';
export const STACKS_PAYMENT_ASSET = process.env.STACKS_PAYMENT_ASSET || 'STX';
export const STACKS_PAYMENT_CONTRACT = process.env.STACKS_PAYMENT_CONTRACT || '';
export const STACKS_PAYMENT_MEMO_PREFIX = process.env.STACKS_PAYMENT_MEMO_PREFIX || 'x402-autoscholar';

export function buildStacksPaymentRequest({ jobId, amount, asset }) {
  const selectedAsset = asset || STACKS_PAYMENT_ASSET;
  const hasContract = Boolean(STACKS_PAYMENT_CONTRACT);
  return {
    network: STACKS_NETWORK,
    apiBase: STACKS_API_BASE,
    recipient: STACKS_RECIPIENT,
    payer: 'user-wallet-connect',
    asset: selectedAsset,
    assetType: selectedAsset === 'STX' && !hasContract ? 'native-stx' : 'clarity-asset',
    amount,
    memo: `${STACKS_PAYMENT_MEMO_PREFIX}:${jobId}`,
    contract: STACKS_PAYMENT_CONTRACT || 'ST2AUTOSCHOLARTESTNETTREASURY111111111111111.autoscholar-payments',
    settlementMethod: 'clarity-contract-call',
    explorerUrl: 'https://explorer.hiro.so/?chain=testnet'
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
    sender: sender || 'user-wallet-connect',
    recipient: recipient || STACKS_RECIPIENT,
    amount,
    asset,
    memo: memo || null,
    chain: STACKS_NETWORK,
    apiBase: STACKS_API_BASE,
    verificationTarget: STACKS_PAYMENT_CONTRACT ? 'clarity-contract-state' : 'clarity-contract-call',
    reason: txid === 'demo-stacks-txid' ? null : 'real verification not configured yet'
  };
}
