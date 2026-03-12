export const X402_VERSION = '0.1-draft';
export const X402_SCHEME = 'x402';

export function buildX402Challenge({ jobId, amount, asset, paymentRequest }) {
  return {
    version: X402_VERSION,
    scheme: X402_SCHEME,
    challengeType: 'payment-required',
    jobId,
    amount,
    asset,
    settlement: {
      layer: 'Stacks',
      network: paymentRequest.network,
      recipient: paymentRequest.recipient,
      contract: paymentRequest.contract,
      memo: paymentRequest.memo
    },
    unlock: {
      resource: `/api/jobs/${jobId}/pay`,
      capability: 'premium-report',
      includes: ['ai-parliament-report', 'debate-transcript', 'specialist-assets']
    }
  };
}

export function buildX402Headers(challenge) {
  return {
    'x-payment-required': 'true',
    'x-payment-scheme': challenge.scheme,
    'x-payment-version': challenge.version,
    'x-payment-network': challenge.settlement.network,
    'x-payment-asset': challenge.asset,
    'x-payment-amount': String(challenge.amount),
    'x-payment-recipient': challenge.settlement.recipient,
    'x-payment-memo': challenge.settlement.memo,
    'x-payment-resource': challenge.unlock.resource
  };
}
