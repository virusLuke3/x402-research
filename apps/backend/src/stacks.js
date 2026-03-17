import crypto from 'crypto';

export const DEFAULT_STACKS_NETWORK = 'testnet';
export const DEFAULT_STACKS_API_BASE = 'https://api.testnet.hiro.so';
export const DEFAULT_STACKS_RECIPIENT = 'ST2JXKMSH007NPYAQHKJPQMAQYAD90NQGTVJVQ02';
export const DEFAULT_STACKS_PAYMENT_ASSET = 'STX';
export const DEFAULT_STACKS_PAYMENT_CONTRACT = 'ST2JXKMSH007NPYAQHKJPQMAQYAD90NQGTVJVQ02.autoscholar-payments';
export const DEFAULT_STACKS_PAYMENT_MEMO_PREFIX = 'x402-autoscholar';
export const DEFAULT_STACKS_CHALLENGE_TTL_SECONDS = 900;

export function getStacksConfig() {
  return {
    network: process.env.STACKS_NETWORK || DEFAULT_STACKS_NETWORK,
    apiBase: (process.env.STACKS_API_BASE || DEFAULT_STACKS_API_BASE).replace(/\/$/, ''),
    recipient: process.env.STACKS_RECIPIENT || DEFAULT_STACKS_RECIPIENT,
    paymentAsset: process.env.STACKS_PAYMENT_ASSET || DEFAULT_STACKS_PAYMENT_ASSET,
    paymentContract: process.env.STACKS_PAYMENT_CONTRACT || DEFAULT_STACKS_PAYMENT_CONTRACT,
    memoPrefix: process.env.STACKS_PAYMENT_MEMO_PREFIX || DEFAULT_STACKS_PAYMENT_MEMO_PREFIX,
    challengeTtlSeconds: Number(process.env.STACKS_CHALLENGE_TTL_SECONDS || DEFAULT_STACKS_CHALLENGE_TTL_SECONDS),
    paymentAmount: process.env.STACKS_PAYMENT_AMOUNT || '500000',
  };
}

export const STACKS_NETWORK = getStacksConfig().network;
export const STACKS_API_BASE = getStacksConfig().apiBase;
export const STACKS_RECIPIENT = getStacksConfig().recipient;
export const STACKS_PAYMENT_ASSET = getStacksConfig().paymentAsset;
export const STACKS_PAYMENT_CONTRACT = getStacksConfig().paymentContract;
export const STACKS_PAYMENT_MEMO_PREFIX = getStacksConfig().memoPrefix;
export const STACKS_CHALLENGE_TTL_SECONDS = getStacksConfig().challengeTtlSeconds;
export const ALLOW_DEMO_PAYMENTS = process.env.ALLOW_DEMO_PAYMENTS === 'true';

export function buildStacksPaymentRequest({ jobId, amount, asset }) {
  const config = getStacksConfig();
  const selectedAsset = asset || config.paymentAsset;
  const hasContract = Boolean(config.paymentContract);
  const paymentId = `pay_${crypto.randomBytes(8).toString('hex')}`;
  const nonce = crypto.randomBytes(12).toString('hex');
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + config.challengeTtlSeconds * 1000).toISOString();

  return {
    network: config.network,
    apiBase: config.apiBase,
    recipient: config.recipient,
    payer: null,
    asset: selectedAsset,
    assetType: selectedAsset === 'STX' && !hasContract ? 'native-stx' : 'clarity-asset',
    amount,
    displayAmount: formatStacksAssetAmount(selectedAsset, amount),
    memo: `${config.memoPrefix}:${jobId}`,
    contract: config.paymentContract || 'ST2AUTOSCHOLARTESTNETTREASURY111111111111111.autoscholar-payments',
    settlementMethod: 'clarity-contract-call',
    explorerUrl: `https://explorer.hiro.so/?chain=${config.network}`,
    issuedAt: issuedAt.toISOString(),
    expiresAt,
    paymentId,
    nonce,
    resource: `/api/jobs/${jobId}/pay`,
    description: 'Unlock premium research report via x402 on Stacks.'
  };
}

export function isPaymentRequestExpired(paymentRequest) {
  if (!paymentRequest?.expiresAt) return false;
  return Date.now() > Date.parse(paymentRequest.expiresAt);
}

export async function verifyStacksPayment({
  txid,
  sender,
  recipient,
  amount,
  asset,
  memo,
  jobId,
  contract,
  paymentId,
  paymentRequest,
}) {
  if (!txid) {
    return { ok: false, reason: 'missing txid' };
  }

  const config = getStacksConfig();

  if (ALLOW_DEMO_PAYMENTS && txid === 'demo-stacks-txid') {
    return {
      ok: true,
      mode: 'demo-verification',
      txid,
      sender: sender || 'user-wallet-connect',
      recipient: recipient || config.recipient,
      amount,
      asset,
      memo: memo || null,
      chain: config.network,
      apiBase: config.apiBase,
      verificationTarget: config.paymentContract ? 'clarity-contract-call' : 'token-transfer',
      paymentId: paymentId || paymentRequest?.paymentId || null,
      rawTx: null,
      reason: null,
    };
  }

  let tx;
  try {
    tx = await fetchStacksTransaction(txid);
  } catch (error) {
    return {
      ok: false,
      reason: error.message || 'failed to fetch tx details',
      txid,
      chain: config.network,
      apiBase: config.apiBase,
    };
  }

  if (!isSuccessfulTx(tx)) {
    return {
      ok: false,
      reason: `transaction not successful: ${tx?.tx_status || 'unknown'}`,
      txid,
      rawTx: tx,
      chain: config.network,
      apiBase: config.apiBase,
    };
  }

  const expected = {
    sender,
    recipient: recipient || config.recipient,
    amount: String(amount),
    asset,
    memo,
    jobId,
    contract: contract || config.paymentContract,
    paymentId: paymentId || paymentRequest?.paymentId || null,
  };

  const verification = tx?.tx_type === 'contract_call'
    ? verifyContractCallTx(tx, expected)
    : verifyTokenTransferTx(tx, expected);

  if (!verification.ok) {
    return {
      ...verification,
      txid,
      rawTx: tx,
      chain: config.network,
      apiBase: config.apiBase,
    };
  }

  return {
    ok: true,
    mode: 'hiro-api-verification',
    txid,
    sender: tx?.sender_address || sender || null,
    recipient: verification.recipient || expected.recipient,
    amount: verification.amount || expected.amount,
    asset: expected.asset,
    memo: verification.memo || expected.memo,
    chain: config.network,
    apiBase: config.apiBase,
    verificationTarget: tx?.tx_type === 'contract_call' ? 'clarity-contract-call' : 'token-transfer',
    paymentId: expected.paymentId,
    rawTx: tx,
    reason: null,
  };
}

export async function inspectStacksTransaction(txid, apiBase = getStacksConfig().apiBase) {
  if (!txid) {
    return {
      ok: false,
      txid: txid || null,
      apiBase,
      httpStatus: null,
      tx: null,
      status: null,
      reason: 'missing txid',
    };
  }

  try {
    const response = await fetch(`${apiBase}/extended/v1/tx/${txid}`);
    if (!response.ok) {
      return {
        ok: false,
        txid,
        apiBase,
        httpStatus: response.status,
        tx: null,
        status: null,
        reason: `Hiro API returned ${response.status} for tx ${txid}`,
      };
    }

    const tx = await response.json();
    return {
      ok: true,
      txid,
      apiBase,
      httpStatus: response.status,
      tx,
      status: tx?.tx_status || null,
      reason: null,
    };
  } catch (error) {
    return {
      ok: false,
      txid,
      apiBase,
      httpStatus: null,
      tx: null,
      status: null,
      reason: error.message || 'failed to inspect Stacks transaction',
    };
  }
}

async function fetchStacksTransaction(txid) {
  const inspection = await inspectStacksTransaction(txid);
  if (!inspection.ok) {
    throw new Error(inspection.reason || `failed to inspect tx ${txid}`);
  }
  return inspection.tx;
}

export function parseStacksContractPrincipal(contractPrincipal) {
  const [address, contractName] = String(contractPrincipal || '').split('.');
  if (!address || !contractName) {
    return { ok: false, address: null, contractName: null, contractPrincipal: contractPrincipal || null };
  }
  return { ok: true, address, contractName, contractPrincipal: `${address}.${contractName}` };
}

export async function inspectStacksContract(contractPrincipal, apiBase = getStacksConfig().apiBase) {
  const parsed = parseStacksContractPrincipal(contractPrincipal);
  if (!parsed.ok) {
    return { ...parsed, deployed: false, httpStatus: null, reason: 'invalid contract principal' };
  }

  try {
    const response = await fetch(`${apiBase}/v2/contracts/source/${parsed.address}/${parsed.contractName}`);
    if (!response.ok) {
      return {
        ...parsed,
        deployed: false,
        httpStatus: response.status,
        reason: response.status === 404 ? 'contract not deployed on configured network' : `hiro returned ${response.status}`,
      };
    }

    const source = await response.text();
    return {
      ...parsed,
      deployed: true,
      httpStatus: response.status,
      sourceLength: source.length,
      reason: null,
    };
  } catch (error) {
    return {
      ...parsed,
      deployed: false,
      httpStatus: null,
      reason: error.message || 'failed to inspect contract deployment',
    };
  }
}

export async function getStacksPaymentReadiness() {
  const config = getStacksConfig();
  const contract = await inspectStacksContract(config.paymentContract, config.apiBase);
  const missing = [];
  const warnings = [];

  if (!process.env.STACKS_PAYMENT_CONTRACT) {
    missing.push('STACKS_PAYMENT_CONTRACT');
  }
  if (!process.env.STACKS_RECIPIENT) {
    missing.push('STACKS_RECIPIENT');
  }
  if (!process.env.STACKS_PAYMENT_AMOUNT) {
    warnings.push('Using default STACKS_PAYMENT_AMOUNT=500000 (0.5 STX).');
  }
  if (!contract.deployed) {
    warnings.push(contract.reason || 'Stacks payment contract is not deployed on the configured network.');
  }
  if (contract.address && config.recipient !== contract.address) {
    warnings.push('STACKS_RECIPIENT does not match the contract deployer address. Confirm this is the treasury you want to receive STX.');
  }
  if (config.paymentAsset !== 'STX') {
    warnings.push('Current contract path only performs real settlement for STX.');
  }
  if (!/^\d+$/.test(String(config.paymentAmount)) || BigInt(String(config.paymentAmount)) <= 0n) {
    warnings.push('STACKS_PAYMENT_AMOUNT must be a positive integer in micro-STX.');
  }

  return {
    ok: missing.length === 0 && contract.deployed && warnings.every((warning) => !warning.includes('must be a positive integer')),
    network: config.network,
    apiBase: config.apiBase,
    recipient: config.recipient,
    paymentAsset: config.paymentAsset,
    paymentAmount: config.paymentAmount,
    displayAmount: formatStacksAssetAmount(config.paymentAsset, config.paymentAmount),
    paymentContract: config.paymentContract,
    explorerUrl: `https://explorer.hiro.so/?chain=${config.network}`,
    allowDemoPayments: ALLOW_DEMO_PAYMENTS,
    walletSupport: {
      testedWallets: ['Leather', 'Xverse'],
      recommendedWallet: 'Leather',
      network: config.network,
    },
    contract,
    missing,
    warnings,
    configuredFromEnv: {
      contract: Boolean(process.env.STACKS_PAYMENT_CONTRACT),
      recipient: Boolean(process.env.STACKS_RECIPIENT),
      paymentAmount: Boolean(process.env.STACKS_PAYMENT_AMOUNT),
    },
    needs: [
      !contract.deployed ? 'deploy contract to Stacks testnet' : null,
      !process.env.STACKS_PAYMENT_CONTRACT ? 'set STACKS_PAYMENT_CONTRACT in .env' : null,
      !process.env.STACKS_RECIPIENT ? 'set STACKS_RECIPIENT in .env' : null,
      'fund Leather testnet account with STX',
    ].filter(Boolean),
  };
}

function isSuccessfulTx(tx) {
  return tx?.tx_status === 'success';
}

function verifyContractCallTx(tx, expected) {
  const contractId = tx?.contract_call?.contract_id;
  const functionName = tx?.contract_call?.function_name;
  const args = tx?.contract_call?.function_args || [];
  const decodedArgs = args.map((arg) => ({
    ...arg,
    decoded: decodeClarityRepr(arg?.repr),
  }));

  const senderAddress = tx?.sender_address;
  if (expected.sender && senderAddress && expected.sender !== senderAddress) {
    return { ok: false, reason: 'sender mismatch' };
  }
  if (expected.contract && contractId !== expected.contract) {
    return { ok: false, reason: `contract mismatch: expected ${expected.contract}, got ${contractId}` };
  }
  if (functionName !== 'pay-invoice') {
    return { ok: false, reason: `unexpected function: ${functionName}` };
  }

  const [jobIdArg, recipientArg, amountArg, assetArg, memoArg, paymentIdArg] = decodedArgs;
  if (expected.jobId && jobIdArg?.decoded !== expected.jobId) {
    return { ok: false, reason: 'job-id mismatch' };
  }
  if (expected.recipient && recipientArg?.decoded !== expected.recipient) {
    return { ok: false, reason: 'recipient mismatch' };
  }
  if (expected.amount && String(amountArg?.decoded) !== String(expected.amount)) {
    return { ok: false, reason: 'amount mismatch' };
  }
  if (expected.asset && assetArg?.decoded !== expected.asset) {
    return { ok: false, reason: 'asset mismatch' };
  }
  if (expected.memo && memoArg?.decoded !== expected.memo) {
    return { ok: false, reason: 'memo mismatch' };
  }
  if (expected.paymentId && paymentIdArg?.decoded !== expected.paymentId) {
    return { ok: false, reason: 'payment-id mismatch' };
  }

  const transferEvent = findMatchingStxTransfer(tx?.events || [], {
    sender: tx?.sender_address,
    recipient: expected.recipient,
    amount: String(expected.amount),
  });
  if (!transferEvent) {
    return { ok: false, reason: 'missing matching STX transfer event' };
  }

  return {
    ok: true,
    recipient: recipientArg?.decoded,
    amount: String(amountArg?.decoded),
    memo: memoArg?.decoded,
  };
}

function verifyTokenTransferTx(tx, expected) {
  const transfer = tx?.token_transfer;
  if (!transfer) {
    return { ok: false, reason: 'transaction is not a token transfer or contract call' };
  }
  if (expected.sender && tx?.sender_address && expected.sender !== tx.sender_address) {
    return { ok: false, reason: 'sender mismatch' };
  }
  if (expected.recipient && transfer?.recipient_address !== expected.recipient) {
    return { ok: false, reason: 'recipient mismatch' };
  }
  if (expected.amount && String(transfer?.amount) !== String(expected.amount)) {
    return { ok: false, reason: 'amount mismatch' };
  }
  if (expected.memo && transfer?.memo !== expected.memo) {
    return { ok: false, reason: 'memo mismatch' };
  }

  return {
    ok: true,
    recipient: transfer?.recipient_address,
    amount: String(transfer?.amount),
    memo: transfer?.memo || null,
  };
}

function decodeClarityRepr(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (/^u\d+$/.test(trimmed)) return trimmed.slice(1);
  if (/^".*"$/.test(trimmed)) return trimmed.slice(1, -1);
  if (/^\(some\s+".*"\)$/.test(trimmed)) return trimmed.slice(7, -2);
  if (/^\(some\s+'[^)]+\)$/.test(trimmed)) return trimmed.slice(7, -1);
  if (/^'/.test(trimmed)) return trimmed.slice(1);
  return trimmed;
}

function findMatchingStxTransfer(events, expected) {
  return events.find((event) => {
    if (event?.event_type !== 'stx_asset') return false;
    const transferCandidate = event?.asset || event?.stx_asset || null;
    const transfer = transferCandidate?.asset_event_type === 'transfer' ? transferCandidate : event;
    return (
      String(transfer?.amount ?? '') === String(expected.amount) &&
      transfer?.recipient === expected.recipient &&
      transfer?.sender === expected.sender
    );
  }) || null;
}

function formatStacksAssetAmount(asset, amount) {
  if (asset === 'STX') {
    const value = Number(amount || 0) / 1_000_000;
    return `${value} STX`;
  }
  return `${amount} ${asset}`;
}
