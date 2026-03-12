export function buildClarityPaymentSpec({ jobId, recipient, amount, asset, memo, contract }) {
  return {
    language: 'Clarity',
    network: 'testnet',
    contractPrincipal: contract || 'ST2AUTOSCHOLARTESTNETTREASURY111111111111111.autoscholar-payments',
    publicFunction: 'pay-invoice',
    expectedArgs: [
      { name: 'job-id', type: '(string-ascii 64)', value: jobId },
      { name: 'amount', type: 'uint', value: amount },
      { name: 'asset', type: '(string-ascii 32)', value: asset },
      { name: 'memo', type: '(string-ascii 128)', value: memo }
    ],
    postConditions: [
      {
        principal: recipient,
        condition: 'sent-equal-to',
        asset,
        amount
      }
    ],
    replayKey: `${jobId}:${memo}`,
    verificationTargets: ['tx-status-success', 'contract-call-match', 'memo-match', 'replay-check']
  };
}

export function buildClarityVerificationPlan(paymentRequest) {
  return {
    mode: paymentRequest.contract ? 'clarity-contract-call' : 'clarity-ready-transfer',
    checks: [
      'transaction succeeded on stacks testnet',
      'recipient or contract principal matches platform treasury/payment contract',
      'amount matches invoice amount',
      'memo or job-id binding matches x402 challenge',
      'job has not already been settled'
    ],
    replayKey: paymentRequest.clarity?.replayKey || null
  };
}
