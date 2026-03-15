export const X402_VERSION = '0.1-draft';
export const X402_SCHEME = 'x402';

export function buildX402Challenge({ jobId, amount, asset, paymentRequest }) {
  return {
    version: X402_VERSION,
    scheme: X402_SCHEME,
    challengeType: 'payment-required',
    jobId,
    paymentId: paymentRequest.paymentId,
    nonce: paymentRequest.nonce,
    expiresAt: paymentRequest.expiresAt,
    amount,
    displayAmount: paymentRequest.displayAmount || String(amount),
    asset,
    maxAmountRequired: String(amount),
    assetType: paymentRequest.assetType,
    assetAddress: paymentRequest.contract || null,
    paymentAddress: paymentRequest.recipient,
    network: paymentRequest.network,
    resource: paymentRequest.resource,
    description: paymentRequest.description,
    settlement: {
      layer: 'Stacks',
      network: paymentRequest.network,
      recipient: paymentRequest.recipient,
      payer: paymentRequest.payer,
      assetType: paymentRequest.assetType,
      contract: paymentRequest.contract,
      memo: paymentRequest.memo,
      settlementMethod: paymentRequest.settlementMethod,
      apiBase: paymentRequest.apiBase,
      explorerUrl: paymentRequest.explorerUrl
    },
    unlock: {
      resource: paymentRequest.resource || `/api/jobs/${jobId}/pay`,
      capability: 'premium-report',
      includes: ['ai-parliament-report', 'debate-transcript', 'specialist-assets']
    },
    authorization: {
      type: 'stacks-tx-proof',
      requiredFields: ['txid', 'sender', 'paymentId', 'nonce', 'expiresAt'],
      verification: ['match challenge metadata', 'verify stacks settlement transaction', 'enforce replay-safe consumption']
    }
  };
}

export function buildX402Headers(challenge) {
  return {
    'x-payment-required': 'true',
    'x-payment-scheme': challenge.scheme,
    'x-payment-version': challenge.version,
    'x-payment-network': challenge.network || challenge.settlement.network,
    'x-payment-asset': challenge.asset,
    'x-payment-asset-type': challenge.assetType || challenge.settlement.assetType,
    'x-payment-amount': String(challenge.maxAmountRequired || challenge.amount),
    'x-payment-recipient': challenge.paymentAddress || challenge.settlement.recipient,
    'x-payment-memo': challenge.settlement.memo,
    'x-payment-resource': challenge.resource || challenge.unlock.resource,
    'x-payment-id': challenge.paymentId,
    'x-payment-nonce': challenge.nonce,
    'x-payment-expires-at': challenge.expiresAt
  };
}
