const inMemoryInvoiceState = new Map();

export function seedContractInvoiceState({ jobId, invoiceStatus = 'created', paymentRequest, paymentReceipt = null }) {
  inMemoryInvoiceState.set(jobId, {
    jobId,
    source: 'adapter-simulated',
    contractPrincipal: paymentRequest?.clarity?.contractPrincipal || paymentRequest?.stacks?.contract || null,
    invoiceStatus,
    paid: invoiceStatus === 'paid' || invoiceStatus === 'consumed',
    consumed: invoiceStatus === 'consumed',
    readOnlyFns: ['get-invoice', 'get-invoice-status', 'is-paid', 'is-consumed', 'has-replay-key'],
    nextAction: invoiceStatus === 'created' ? 'pay-invoice' : invoiceStatus === 'paid' ? 'consume-payment' : null,
    stateMachine: ['created', 'paid', 'consumed'],
    paymentReceipt,
    updatedAt: new Date().toISOString()
  });
}

export async function readContractInvoiceState({ jobId, paymentRequest, paymentReceipt }) {
  const existing = inMemoryInvoiceState.get(jobId);
  if (existing) {
    return existing;
  }

  const stateMachine = ['created', 'paid', 'consumed'];
  const inferredStatus = paymentReceipt?.invoiceStatus || 'created';
  const consumed = inferredStatus === 'consumed';
  const paid = inferredStatus === 'paid' || consumed;

  const state = {
    source: 'adapter-simulated',
    contractPrincipal: paymentRequest?.clarity?.contractPrincipal || paymentRequest?.stacks?.contract || null,
    jobId,
    stateMachine,
    invoiceStatus: inferredStatus,
    paid,
    consumed,
    readOnlyFns: ['get-invoice', 'get-invoice-status', 'is-paid', 'is-consumed', 'has-replay-key'],
    nextAction: consumed ? null : paid ? 'consume-payment' : 'pay-invoice',
    updatedAt: new Date().toISOString()
  };

  inMemoryInvoiceState.set(jobId, state);
  return state;
}

export async function markContractInvoicePaid({ jobId, paymentRequest, paymentReceipt }) {
  seedContractInvoiceState({
    jobId,
    invoiceStatus: 'paid',
    paymentRequest,
    paymentReceipt
  });
  return inMemoryInvoiceState.get(jobId);
}

export async function markContractInvoiceConsumed({ jobId, paymentRequest, paymentReceipt }) {
  seedContractInvoiceState({
    jobId,
    invoiceStatus: 'consumed',
    paymentRequest,
    paymentReceipt
  });
  return inMemoryInvoiceState.get(jobId);
}
