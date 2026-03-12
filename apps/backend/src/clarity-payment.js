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
      'contract principal matches autoscholar-payments contract',
      'public function is pay-invoice',
      'job-id / amount / asset / memo args match x402 challenge',
      'invoice status transitions from created to paid',
      'replay key has not been consumed before premium unlock'
    ],
    stateMachine: ['created', 'paid', 'consumed'],
    replayKey: paymentRequest.clarity?.replayKey || null,
    consumeFunction: 'consume-payment',
    statusReader: 'get-invoice-status'
  };
}
