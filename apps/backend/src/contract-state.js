export async function readContractInvoiceState({ jobId, paymentRequest, paymentReceipt }) {
  const stateMachine = ['created', 'paid', 'consumed'];

  // V7.6 adapter scaffold.
  // Future implementation targets:
  // 1. Clarinet console/SDK for local contract simulation
  // 2. Hiro API / read-only contract calls on testnet
  // 3. Mapping contract state to backend unlock state

  const inferredStatus = paymentReceipt?.invoiceStatus || 'created';
  const consumed = inferredStatus === 'consumed';
  const paid = inferredStatus === 'paid' || consumed;

  return {
    source: 'adapter-simulated',
    contractPrincipal: paymentRequest?.clarity?.contractPrincipal || paymentRequest?.stacks?.contract || null,
    jobId,
    stateMachine,
    invoiceStatus: inferredStatus,
    paid,
    consumed,
    readOnlyFns: ['get-invoice', 'get-invoice-status', 'is-paid', 'is-consumed', 'has-replay-key'],
    nextAction: consumed ? null : paid ? 'consume-payment' : 'pay-invoice'
  };
}
