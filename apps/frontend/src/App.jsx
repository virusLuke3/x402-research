import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const STACKS_NETWORK = 'testnet';
const TX_POLL_INTERVAL_MS = 4000;
const TX_POLL_MAX_ATTEMPTS = 40;
const TX_POLL_MAX_TRANSIENT_ERRORS = 4;
const INITIAL_READINESS_DELAY_MS = 800;
const TX_EXPLORER_BASE = 'https://explorer.hiro.so/txid';

let stacksClientPromise = null;

async function loadStacksClient() {
  if (!stacksClientPromise) {
    stacksClientPromise = Promise.all([
      import('@stacks/connect'),
      import('@stacks/transactions')
    ]).then(([connectModule, transactionsModule]) => ({
      walletRequest: connectModule.request,
      Cl: transactionsModule.Cl,
      Pc: transactionsModule.Pc
    }));
  }
  return stacksClientPromise;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const raw = await response.text();
  const data = raw ? safeJsonParse(raw) : {};
  if (!response.ok) {
    const error = new Error(data?.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.responseData = data;
    throw error;
  }
  return data;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return { raw: value };
  }
}

function shortAddress(value) {
  const text = String(value || '');
  if (text.length < 12) return text || 'n/a';
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

function formatErrorMessage(error) {
  const verificationReason = error?.responseData?.verification?.reason;
  const backendReason = error?.responseData?.reason;
  if (verificationReason) return `${error.message}: ${verificationReason}`;
  if (backendReason) return `${error.message}: ${backendReason}`;
  return error?.message || 'Request failed';
}

function buildExplorerTxUrl(txid, network = STACKS_NETWORK) {
  return txid ? `${TX_EXPLORER_BASE}/${txid}?chain=${network}` : '';
}

function StatusPill({ status }) {
  const normalized = status ? String(status).replaceAll('-', '_') : 'idle';
  const label = normalized.replaceAll('_', ' ');
  return <span className={`statusPill status-${normalized}`}>{label}</span>;
}

function DetailRow({ label, value, mono = false }) {
  return (
    <div className="detailRow">
      <span>{label}</span>
      <strong className={mono ? 'monoText' : ''}>{value}</strong>
    </div>
  );
}

function formatTimestamp(value) {
  if (!value) return 'Pending';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function stringifyPayload(value) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function TaskTreePanel({ taskTree }) {
  const nodes = taskTree?.nodes || [];
  if (!nodes.length) {
    return (
      <div className="traceCard">
        <div className="traceCardHeader">
          <div>
            <p className="traceEyebrow">Task Tree</p>
            <h3>Specialist bundle not created yet</h3>
          </div>
        </div>
      </div>
    );
  }

  const depths = [...new Set(nodes.map((node) => node.depth))].sort((a, b) => a - b);

  return (
    <div className="traceCard">
      <div className="traceCardHeader">
        <div>
          <p className="traceEyebrow">Task Tree</p>
          <h3>Bundled specialist execution graph</h3>
        </div>
        <StatusPill status={taskTree?.stage} />
      </div>
      <div className="traceMetaGrid">
        <div className="traceMeta">
          <span>Total Nodes</span>
          <strong>{taskTree?.summary?.totalNodes || 0}</strong>
        </div>
        <div className="traceMeta">
          <span>Paid Nodes</span>
          <strong>{taskTree?.summary?.paidNodes || 0}</strong>
        </div>
        <div className="traceMeta">
          <span>Specialists</span>
          <strong>{taskTree?.summary?.specialistNodes || 0}</strong>
        </div>
      </div>
      <div className="taskLaneGrid">
        {depths.map((depth) => (
          <div key={depth} className="taskLane">
            <p className="traceEyebrow">Depth {depth}</p>
            <div className="taskLaneStack">
              {nodes
                .filter((node) => node.depth === depth)
                .map((node) => (
                  <div key={node.id} className="taskNode">
                    <div className="taskNodeHeader">
                      <div>
                        <h4>{node.label}</h4>
                        <p>{node.role}</p>
                      </div>
                      <StatusPill status={node.status} />
                    </div>
                    <div className="taskNodeMeta">
                      <span>{node.agent}</span>
                      <span>{node.pricing?.displayAmount || 'Bundled / free'}</span>
                    </div>
                    <p className="taskNodeSummary">{node.resultSummary}</p>
                    <p className="taskNodeHint">Unlock condition: {node.unlockCondition}</p>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommerceTracePanel({ commerceTrace }) {
  const events = commerceTrace?.events || [];
  if (!events.length) {
    return (
      <div className="traceCard">
        <div className="traceCardHeader">
          <div>
            <p className="traceEyebrow">Commerce Trace</p>
            <h3>No trace yet</h3>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="traceCard">
      <div className="traceCardHeader">
        <div>
          <p className="traceEyebrow">Commerce Trace</p>
          <h3>x402 quote, settlement, and delivery lifecycle</h3>
        </div>
        <StatusPill status={commerceTrace?.stage} />
      </div>
      <div className="traceTimeline">
        {events.map((event) => (
          <div key={event.id} className={`traceEvent traceEvent-${String(event.status || 'idle').replaceAll('-', '_')}`}>
            <div className="traceEventHeader">
              <div>
                <h4>{event.title}</h4>
                <p>{event.detail}</p>
              </div>
              <StatusPill status={event.status} />
            </div>
            <div className="traceEventMeta">
              <span>{event.actor}</span>
              <span>{formatTimestamp(event.timestamp)}</span>
              {event.amountDisplay ? <span>{event.amountDisplay}</span> : null}
              {event.txid ? <span className="monoText">{shortAddress(event.txid)}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OutputManifestPanel({ outputs }) {
  const items = outputs?.items || [];
  if (!items.length) {
    return (
      <div className="traceCard">
        <div className="traceCardHeader">
          <div>
            <p className="traceEyebrow">Outputs</p>
            <h3>No deliverables yet</h3>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="traceCard">
      <div className="traceCardHeader">
        <div>
          <p className="traceEyebrow">Outputs</p>
          <h3>Human-readable + machine-readable deliverables</h3>
        </div>
        <StatusPill status={outputs?.status} />
      </div>
      <div className="outputStack">
        {items.map((item) => (
          <details key={item.id} className="outputCard" open={item.status === 'ready'}>
            <summary className="outputCardSummary">
              <div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </div>
              <div className="outputCardBadges">
                <span>{item.format}</span>
                <span>{item.audience}</span>
                <StatusPill status={item.status} />
              </div>
            </summary>
            <div className="outputCardBody">
              {item.preview ? (
                <pre>{String(item.preview).split('\n').slice(0, 22).join('\n')}</pre>
              ) : item.payload ? (
                <pre>{stringifyPayload(item.payload)}</pre>
              ) : (
                <p>{item.description}</p>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail, tone = 'default' }) {
  return (
    <div className={`metricCard metricCard-${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </div>
  );
}

export default function App() {
  const [topic, setTopic] = useState('');
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [walletStatus, setWalletStatus] = useState('disconnected');
  const [paymentReadiness, setPaymentReadiness] = useState(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessInitialized, setReadinessInitialized] = useState(false);
  const [executionLog, setExecutionLog] = useState([]);
  const [paymentTxid, setPaymentTxid] = useState('');
  const [verificationDetails, setVerificationDetails] = useState(null);
  const [backendWorkflowPending, setBackendWorkflowPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = null;
    let idleId = null;

    const triggerReadinessCheck = () => {
      if (cancelled) return;
      setReadinessInitialized(true);
      refreshPaymentReadiness({ silent: true }).catch(() => undefined);
    };

    const scheduleCheck = () => {
      timeoutId = window.setTimeout(triggerReadinessCheck, INITIAL_READINESS_DELAY_MS);
    };

    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(scheduleCheck, { timeout: 2000 });
    } else {
      scheduleCheck();
    }

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      if (idleId && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, []);

  useEffect(() => {
    if (!job?.id) return undefined;
    if (!(backendWorkflowPending || job.status === 'preparing' || (job.status === 'processing' && !job.report))) return undefined;

    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const latest = await request(`/api/jobs/${job.id}`);
        if (cancelled) return;
        setJob(latest);
        if (latest?.status === 'failed' && latest?.error) {
          setError(latest.error);
        }
        if (latest?.report || latest?.status === 'failed') {
          setBackendWorkflowPending(false);
        }
      } catch {
        // Keep the optimistic processing UI even if a background poll fails.
      }
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [backendWorkflowPending, job?.id, job?.report, job?.status]);

  function pushExecutionEvent(message, tone = 'info') {
    setExecutionLog((current) => [
      ...current,
      {
        id: `${Date.now()}_${current.length}`,
        message,
        tone
      }
    ]);
  }

  async function refreshPaymentReadiness({ silent = true } = {}) {
    if (!silent) setReadinessLoading(true);
    try {
      const readiness = await request('/api/payment/readiness');
      setPaymentReadiness(readiness);
      return readiness;
    } catch (err) {
      if (!silent) {
        setError(formatErrorMessage(err));
      }
      throw err;
    } finally {
      if (!silent) setReadinessLoading(false);
    }
  }

  async function createJob(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setJob(null);
    setVerificationDetails(null);
    setPaymentTxid('');
    setExecutionLog([]);
    pushExecutionEvent('Submitting task to the Manager Molbot for scoping and pre-payment evidence prep', 'info');

    try {
      const created = await request('/api/research', {
        method: 'POST',
        body: JSON.stringify({ topic, outputLanguage: 'English' })
      });
      setJob(created);
      if (created?.status === 'preparing') {
        pushExecutionEvent('Task accepted. The manager molbot is preparing evidence and assembling the payment quote.', 'info');
      } else {
        pushExecutionEvent(`Pre-payment evidence pack ready: ${created?.papers?.length || 0} sources prepared`, 'success');
        pushExecutionEvent('x402 parent invoice created. Verified payment will release the specialist molbot bundle.', 'muted');
      }
    } catch (err) {
      const message = formatErrorMessage(err);
      setError(message);
      pushExecutionEvent(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function connectWallet(forceWalletSelect = true) {
    const { walletRequest } = await loadStacksClient();
    const response = await walletRequest(
      { forceWalletSelect, persistWalletSelect: true, enableLocalStorage: true },
      'stx_getAddresses',
      { network: STACKS_NETWORK }
    );
    const addressEntry = (response?.addresses || []).find((entry) => String(entry.address || '').startsWith('ST'));
    if (!addressEntry?.address) {
      throw new Error('No Stacks testnet address returned by wallet');
    }
    setWalletAddress(addressEntry.address);
    setWalletStatus('connected');
    pushExecutionEvent(`Wallet connected: ${shortAddress(addressEntry.address)}`, 'success');
    return addressEntry.address;
  }

  async function handleConnectWallet() {
    setError('');
    try {
      setWalletStatus('connecting');
      pushExecutionEvent('Connecting Leather wallet for parent-invoice settlement', 'info');
      await connectWallet(true);
    } catch (err) {
      const message = formatErrorMessage(err);
      setError(message);
      pushExecutionEvent(message, 'error');
      setWalletStatus('disconnected');
    }
  }

  async function buildContractCallArgs(paymentRequest) {
    const { Cl } = await loadStacksClient();
    const args = paymentRequest?.clarity?.expectedArgs || [];
    return args.map((arg) => {
      if (arg.name === 'recipient') return Cl.standardPrincipal(String(arg.value));
      if (arg.type === 'uint') return Cl.uint(BigInt(String(arg.value)));
      return Cl.stringAscii(String(arg.value));
    });
  }

  function buildAuthorization(paymentRequest) {
    return {
      paymentId: paymentRequest?.x402?.paymentId,
      nonce: paymentRequest?.x402?.nonce,
      expiresAt: paymentRequest?.x402?.expiresAt,
      resource: paymentRequest?.x402?.resource,
      amount: paymentRequest?.x402?.maxAmountRequired
    };
  }

  async function waitForTxSuccess(txid, onUpdate) {
    let transientErrors = 0;
    for (let attempt = 0; attempt < TX_POLL_MAX_ATTEMPTS; attempt += 1) {
      try {
        const inspection = await request(`/api/stacks/tx/${encodeURIComponent(txid)}`);
        const tx = inspection?.tx;
        transientErrors = 0;
        onUpdate?.(tx, attempt + 1, inspection);
        if (tx?.tx_status === 'success') {
          return tx;
        }
        if (
          tx?.tx_status &&
          tx.tx_status !== 'pending' &&
          tx.tx_status !== 'pending_anchor_block' &&
          tx.tx_status !== 'pending_microblock'
        ) {
          throw new Error(`Transaction failed: ${tx.tx_status}`);
        }
      } catch (error) {
        transientErrors += 1;
        onUpdate?.({ tx_status: `poll_error_${transientErrors}` }, attempt + 1, { ok: false, reason: error?.message || 'fetch failed' });
        if (transientErrors > TX_POLL_MAX_TRANSIENT_ERRORS) {
          throw error;
        }
      }
      await new Promise((resolve) => window.setTimeout(resolve, TX_POLL_INTERVAL_MS));
    }
    throw new Error('Timed out waiting for transaction confirmation');
  }

  async function ensureContractDeployed(contractPrincipal) {
    const inspection = await request(`/api/stacks/contracts/${encodeURIComponent(contractPrincipal)}`);
    if (!inspection?.deployed) {
      throw new Error(inspection?.reason || 'Stacks testnet contract is not deployed yet. Deploy autoscholar-payments and set STACKS_PAYMENT_CONTRACT first.');
    }
  }

  async function payAndComplete() {
    if (!job?.id) return;
    setLoading(true);
    setError('');
    setVerificationDetails(null);
    setPaymentTxid('');

    try {
      const latestJob = await request(`/api/jobs/${job.id}`);
      setJob(latestJob);
      if (latestJob?.status !== 'awaiting-payment' || !latestJob?.paymentRequest) {
        throw new Error('Payment quote is still being prepared. Wait for the task to reach awaiting payment.');
      }

      const readiness = await refreshPaymentReadiness({ silent: true });
      if (readiness?.missing?.length) {
        throw new Error(`Payment rail is not ready: missing ${readiness.missing.join(', ')}`);
      }
      if (!readiness?.contract?.deployed) {
        throw new Error('Stacks testnet contract is not deployed yet. Deploy autoscholar-payments and update STACKS_PAYMENT_CONTRACT first.');
      }

      const sender = walletAddress || await connectWallet(false).catch(() => connectWallet(true));
      pushExecutionEvent(`Using sender ${shortAddress(sender)} on ${STACKS_NETWORK} for the parent invoice`, 'info');

      const paymentRequest = latestJob.paymentRequest;
      const contractId = paymentRequest?.clarity?.contractPrincipal || paymentRequest?.stacks?.contract;
      if (!contractId || !contractId.includes('.')) {
        throw new Error('Stacks contract principal is not configured');
      }

      await ensureContractDeployed(contractId);
      pushExecutionEvent(`Settlement contract ready: ${contractId}`, 'success');

      const { walletRequest, Pc } = await loadStacksClient();
      const postConditions = paymentRequest?.asset === 'STX'
        ? [Pc.principal(sender).willSendEq(BigInt(String(paymentRequest.amount))).ustx()]
        : [];

      setWalletStatus('signing');
      pushExecutionEvent(`Waiting for Leather to sign ${paymentRequest?.stacks?.displayAmount || `${paymentRequest.amount} ${paymentRequest.asset}`} and release paid specialist tasks`, 'info');

      const txResult = await walletRequest(
        { forceWalletSelect: false, persistWalletSelect: true, enableLocalStorage: true },
        'stx_callContract',
        {
          contract: contractId,
          functionName: paymentRequest?.clarity?.publicFunction || 'pay-invoice',
          functionArgs: await buildContractCallArgs(paymentRequest),
          network: STACKS_NETWORK,
          postConditions,
          postConditionMode: 'deny',
          address: sender
        }
      );

      if (!txResult?.txid) {
        throw new Error('Wallet did not return a transaction id');
      }

      setWalletStatus('broadcasted');
      setPaymentTxid(txResult.txid);
      pushExecutionEvent(`Transaction broadcasted: ${txResult.txid}`, 'success');

      await waitForTxSuccess(
        txResult.txid,
        (tx, attempt) => {
          const tone = tx?.tx_status === 'success' ? 'success' : 'info';
          pushExecutionEvent(`Hiro poll #${attempt}: ${tx?.tx_status || 'unknown'}`, tone);
        }
      );

      setWalletStatus('verifying');
      pushExecutionEvent('Payment confirmed on Hiro. Submitting proof so the specialist molbot bundle can start.', 'info');
      setBackendWorkflowPending(true);
      setVerificationDetails({
        txid: txResult.txid,
        sender,
        invoiceStatus: 'verifying'
      });
      setJob((current) => current ? {
        ...current,
        status: 'processing'
      } : current);
      pushExecutionEvent('Backend accepted payment proof. Running paid specialists and packaging outputs. This can take a few minutes.', 'info');

      const completed = await request(`/api/jobs/${job.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          txid: txResult.txid,
          sender,
          authorization: buildAuthorization(paymentRequest)
        })
      });

      setJob(completed);
      setVerificationDetails(completed?.paymentReceipt || null);
      setBackendWorkflowPending(false);
      if (completed?.status === 'completed_with_fallback') {
        pushExecutionEvent('Payment verified, but delivery used a degraded synthesis fallback.', 'warn');
      } else {
        pushExecutionEvent('Payment verified. Paid specialists completed and deliverables were unlocked.', 'success');
      }
      setWalletStatus('connected');
    } catch (err) {
      setVerificationDetails(err?.responseData?.verification || null);
      const message = formatErrorMessage(err);
      setError(message);
      pushExecutionEvent(message, 'error');
      setBackendWorkflowPending(false);
      setWalletStatus(walletAddress ? 'connected' : 'disconnected');
    } finally {
      setLoading(false);
    }
  }

  const reportMarkdown = job?.report?.markdown?.trim();
  const hasReport = Boolean(job?.report);
  const reportTitle = job?.report?.title || 'Research Dossier';
  const paymentStatus = job?.paymentReceipt
    ? 'paid'
    : backendWorkflowPending
      ? 'processing'
    : job?.status === 'preparing'
      ? 'processing'
    : job?.status === 'awaiting-payment'
      ? 'pending'
      : job?.status === 'failed'
        ? 'failed'
        : job
          ? 'processing'
          : 'idle';
  const displayAmount = job?.paymentRequest?.stacks?.displayAmount || paymentReadiness?.displayAmount || '0.5 STX';
  const contractPrincipal = paymentReadiness?.paymentContract || job?.paymentRequest?.stacks?.contract || 'Not configured';
  const recipient = paymentReadiness?.recipient || job?.paymentRequest?.recipient || 'Not configured';
  const network = paymentReadiness?.network || job?.paymentRequest?.stacks?.network || STACKS_NETWORK;
  const txExplorerUrl = buildExplorerTxUrl(paymentTxid || job?.paymentReceipt?.txid, network);
  const canPay = Boolean(job?.status === 'awaiting-payment');
  const paymentReadyToSign = Boolean(canPay && (job?.paymentRequest?.clarity?.contractPrincipal || job?.paymentRequest?.stacks?.contract));
  const walletReady = walletStatus === 'connected' && walletAddress;
  const serviceBundleCount = job?.serviceManifest?.length || 0;
  const outputCount = job?.outputs?.items?.length || 0;
  const unlockLabel = walletReady
    ? `Sign & Pay ${displayAmount} to Unlock Specialist Bundle`
    : `Connect Leather Wallet`;
  const readinessStatusLabel = !readinessInitialized && !paymentReadiness
    ? 'Checking settlement...'
    : readinessLoading && !paymentReadiness
      ? 'Checking settlement...'
      : paymentReadiness?.ok
        ? 'Settlement ready'
        : 'Setup required';

  const terminalEntries = useMemo(() => {
    const entries = [...executionLog];
    if (!entries.length && !job) return [];

    if (job && !executionLog.length) {
      entries.push({
        id: 'job-created',
        message: `Task created for topic: ${job.topic}`,
        tone: 'info'
      });
      if (job?.papers?.length) {
        entries.push({
          id: 'job-evidence',
          message: `Evidence scan complete: ${job.papers.length} sources prepared`,
          tone: 'success'
        });
      }
    }

    if (backendWorkflowPending) {
      entries.push({
        id: 'job-processing',
        message: 'Backend is running paid specialists and packaging dossier plus JSON handoff outputs.',
        tone: 'info'
      });
    }

    if (job?.status === 'preparing') {
      entries.push({
        id: 'job-preparing',
        message: 'Manager molbot is retrieving evidence and preparing the x402 quote. This can take around 1-2 minutes.',
        tone: 'info'
      });
    }

    if (job?.status === 'awaiting-payment' && !job?.paymentReceipt && !backendWorkflowPending) {
      entries.push({
        id: 'job-locked',
        message: `Awaiting x402 payment to release the specialist bundle priced at ${displayAmount}`,
        tone: 'muted'
      });
    }

    if (job?.status === 'completed' && hasReport) {
      entries.push({
        id: 'job-ready',
        message: 'Dossier and machine-readable deliverables are ready',
        tone: 'success'
      });
    }

    if (job?.status === 'completed_with_fallback') {
      entries.push({
        id: 'job-fallback',
        message: 'Delivery completed with fallback synthesis',
        tone: 'warn'
      });
    }

    if (job?.status === 'failed') {
      entries.push({
        id: 'job-failed',
        message: job.error || 'Workflow failed before report output',
        tone: 'error'
      });
    }

    return entries;
  }, [backendWorkflowPending, displayAmount, executionLog, hasReport, job]);

  async function refreshCurrentJob() {
    if (!job?.id) return;
    setError('');
    try {
      const latest = await request(`/api/jobs/${job.id}`);
      setJob(latest);
      pushExecutionEvent(
        latest?.report ? 'Latest completed report state loaded from the backend.' : `Job state refreshed: ${latest?.status || 'unknown'}`,
        latest?.report ? 'success' : 'info'
      );
    } catch (err) {
      const message = formatErrorMessage(err);
      setError(message);
      pushExecutionEvent(message, 'error');
    }
  }

  return (
    <div className="appShell">
      <header className="topRail">
        <div className="brandCluster">
          <div className="brandSticker">
            <span>AutoScholar</span>
            <span>Research Commerce</span>
          </div>
          <div className="brandCopy">
            <p className="appEyebrow">x402 / Stacks Research Network</p>
            <h2>English research reports with verified payment release</h2>
          </div>
        </div>
        <div className="topRailActions">
          <div className={`topPill ${paymentReadiness?.ok ? 'topPillLive' : ''}`}>
            <span className="topPillDot" />
            {readinessStatusLabel}
          </div>
          <div className="topPill">{walletAddress ? shortAddress(walletAddress) : 'Wallet idle'}</div>
          <button
            type="button"
            className="topButton"
            onClick={() => document.getElementById('task-intake')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            Create Task
          </button>
          {job?.id ? (
            <button
              type="button"
              className="topButton"
              onClick={refreshCurrentJob}
              disabled={loading}
            >
              Refresh Job
            </button>
          ) : null}
          <button
            type="button"
            className="topButton topButtonAccent"
            onClick={handleConnectWallet}
            disabled={loading}
          >
            {walletAddress ? 'Reconnect Wallet' : 'Connect Wallet'}
          </button>
        </div>
      </header>

      <section className="heroPanel">
        <div className="heroCopy">
          <p className="heroEyebrow">Research Workspace</p>
          <h1>Commission a topic, verify payment, and unlock an English report plus handoff artifacts.</h1>
          <p className="heroLead">
            AutoScholar keeps the workflow simple: scope the question, prepare evidence, verify settlement on Stacks, and then deliver a polished English dossier with machine-readable supporting outputs.
          </p>
          <div className="heroHighlights">
            <div className="heroHighlight">
              <strong>English-only output</strong>
              <span>Final dossier and markdown report are generated in English.</span>
            </div>
            <div className="heroHighlight">
              <strong>Visible lifecycle</strong>
              <span>You can see whether the system is scoping, awaiting payment, verifying, or writing.</span>
            </div>
            <div className="heroHighlight">
              <strong>Reusable assets</strong>
              <span>Outputs include a human-readable report and structured handoff packets for downstream agents.</span>
            </div>
          </div>
          <div className="heroActionRow">
            <button
              type="button"
              className="heroButton heroButtonPrimary"
              onClick={() => document.getElementById('task-intake')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              Launch Research Task
            </button>
            <button
              type="button"
              className="heroButton heroButtonSecondary"
              onClick={() => document.getElementById('settlement-gateway')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              Inspect Payment Flow
            </button>
          </div>
          <div className="heroTagRow">
            {(job?.serviceManifest || [
              { id: 'dossier', title: 'Research Dossier' },
              { id: 'evidence', title: 'Evidence Pack' },
              { id: 'handoff', title: 'Agent Handoff Packet' }
            ]).map((service) => (
              <span key={service.id} className="heroTag">{service.title}</span>
            ))}
          </div>
        </div>
        <aside className="heroAside">
          <div className="quoteCard">
            <p className="traceEyebrow">Bundle Snapshot</p>
            <div className="quoteAmount">{displayAmount}</div>
            <div className="quoteMeta">
              <span>Job: {job?.id ? shortAddress(job.id) : 'No active job yet'}</span>
              <span>Bundle: {serviceBundleCount || 4} paid specialist services</span>
              <span>Outputs: {outputCount || 3} deliverables</span>
              <span>Status: {job?.status ? String(job.status).replaceAll('_', ' ') : 'idle'}</span>
            </div>
              <button
                type="button"
                className="heroButton heroButtonPrimary quoteButton"
                onClick={walletReady ? payAndComplete : handleConnectWallet}
                disabled={loading || (!job && walletReady) || (walletReady && !paymentReadyToSign)}
              >
                {canPay ? unlockLabel : walletAddress ? 'Create task to quote bundle' : 'Connect wallet to settle'}
              </button>
          </div>
          <div className="stickerCluster">
            <div className="microSticker">x402 VERIFIED</div>
            <div className="microSticker microStickerAlt">STACKS TESTNET</div>
            <div className="microSticker">AGENT OUTPUTS</div>
          </div>
        </aside>
      </section>

      <section className="statsStrip">
        <MetricCard label="Bundle Quote" value={displayAmount} detail="Single parent invoice on Stacks" tone="accent" />
        <MetricCard label="Evidence Prepared" value={`${job?.papers?.length || 0}`} detail="Pre-payment sources staged by the manager" />
        <MetricCard label="Paid Specialists" value={`${serviceBundleCount || 0}`} detail="Capabilities released after verified payment" />
        <MetricCard label="Deliverables" value={`${outputCount || 0}`} detail="English markdown dossier + JSON handoff artifacts" tone="success" />
      </section>

      {reportMarkdown ? (
        <section className="reportShowcase reportShowcaseFeatured">
          <article className="reportCard">
            <div className="reportHeader">
              <div>
                <p className="traceEyebrow">Premium Dossier</p>
                <h3>{reportTitle}</h3>
              </div>
              <div className="reportActions">
                <StatusPill status={job.status} />
                <button type="button" className="secondaryButton reportRefreshButton" onClick={refreshCurrentJob} disabled={loading}>
                  Refresh Result
                </button>
              </div>
            </div>
            <div className="markdownReport">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{reportMarkdown}</ReactMarkdown>
            </div>
          </article>
        </section>
      ) : null}

      <main className="dashboardLayout">
        <section className="dashboardColumn">
          <section className="workspaceCard heroCard" id="task-intake">
            <div className="cardHeader">
              <div>
                <p className="cardEyebrow">Task Intake</p>
                <h2>Commission A Research Workflow</h2>
              </div>
              <span className="cardHint">{API_BASE || '/api proxy'}</span>
            </div>

            <p className="cardCopy">
              Describe the question the way another agent would brief it: what should be investigated, what decision it should support, and what kind of deliverable is needed. The final report is generated in English.
            </p>

            <form onSubmit={createJob} className="queryForm">
              <textarea
                id="topic-input"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                rows={10}
                placeholder="Describe the research task you want this molbot network to investigate. Final report output will be in English..."
              />
              <p className="inputHelper">You can enter any topic you want to learn about. We keep the final dossier in English even if the prompt itself is mixed-language.</p>
              <div className="formActionRow">
                <button className="primaryButton" disabled={loading}>
                  {loading && !canPay ? 'Scoping...' : 'Create Molbot Task'}
                </button>
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={() => setTopic('Design a molbot-to-molbot commerce protocol on Stacks using x402, with research outputs packaged for downstream agents.')}
                >
                  Load Demo Prompt
                </button>
              </div>
            </form>

            {error ? <p className="errorBanner" role="alert">{error}</p> : null}

            {job ? (
              <div className="summaryCard">
                <div className="summaryHeader">
                  <h3>Task Summary</h3>
                  <StatusPill status={job.status} />
                </div>
                <div className="summaryRows">
                  <DetailRow label="Job ID" value={job.id} mono />
                  <DetailRow label="Research Mode" value={job.researchMode || 'analysis'} />
                  <DetailRow label="Evidence Prepared" value={`${job?.papers?.length || 0} sources`} />
                  <DetailRow label="Service Bundle" value={`${serviceBundleCount} paid deliverables`} />
                  <DetailRow label="Outputs" value={`${outputCount || 3} dossier / JSON packets`} />
                </div>
                {job?.serviceManifest?.length ? (
                  <div className="serviceTagGrid">
                    {job.serviceManifest.map((service) => (
                      <div key={service.id} className="serviceTag">
                        <strong>{service.title}</strong>
                        <span>{service.format} · {service.audience}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="placeholderState">
                Create a task to generate a parent invoice, specialist bundle, and agent-readable deliverables.
              </div>
            )}
          </section>

          <section className="workspaceCard" id="settlement-gateway">
            <div className="cardHeader">
              <div>
                <p className="cardEyebrow">Settlement Gateway</p>
                <h2>x402 Quote + Stacks Verification</h2>
              </div>
              <StatusPill status={paymentStatus} />
            </div>

            <p className="cardCopy">
              The gateway quotes the bundle, binds x402 authorization to the job, and only releases paid specialist capabilities after Stacks verification succeeds.
            </p>

            <div className="gatewayGrid">
              <DetailRow label="Network" value={network} />
              <DetailRow label="Asset & Price" value={displayAmount} />
              <DetailRow label="Recipient" value={shortAddress(recipient)} mono />
              <DetailRow label="Contract" value={contractPrincipal} mono />
            </div>

            <div className="walletPanel">
              <div className="walletHeader">
                <div>
                  <h3>Leather Wallet</h3>
                  <p>{walletAddress ? 'Wallet connected and ready to settle the parent invoice on testnet.' : 'Connect a Stacks testnet wallet to continue.'}</p>
                </div>
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={handleConnectWallet}
                  disabled={loading}
                >
                  {walletAddress ? 'Reconnect Leather Wallet' : 'Connect Leather Wallet'}
                </button>
              </div>

              <div className="walletDetails">
                <DetailRow label="Wallet Address" value={walletAddress || 'Not connected'} mono />
                <DetailRow label="Wallet Status" value={walletStatus.replaceAll('_', ' ')} />
              </div>
            </div>

            <button
              type="button"
              className="primaryButton primaryButtonWide"
              onClick={walletReady ? payAndComplete : handleConnectWallet}
              disabled={loading || !job || (walletReady && !paymentReadyToSign)}
            >
              {canPay ? unlockLabel : 'Create a molbot task before payment'}
            </button>

            <div className="gatewayNotes">
              {paymentReadiness?.warnings?.map((warning) => (
                <p key={warning} className="notice noticeWarn">{warning}</p>
              ))}
              {paymentReadiness?.missing?.map((missing) => (
                <p key={missing} className="notice noticeError">Missing configuration: {missing}</p>
              ))}
              {!job ? (
                <p className="notice noticeMuted">No active task yet. Create a task first, then settle the parent invoice.</p>
              ) : null}
            </div>

            {verificationDetails ? (
              <div className="receiptCard">
                <h3>Payment Receipt</h3>
                <div className="summaryRows">
                  <DetailRow label="Transaction" value={verificationDetails.txid || paymentTxid || 'n/a'} mono />
                  <DetailRow label="Sender" value={verificationDetails.sender || walletAddress || 'n/a'} mono />
                  <DetailRow label="Invoice State" value={verificationDetails.invoiceStatus || paymentStatus} />
                </div>
              </div>
            ) : null}

            {txExplorerUrl ? (
              <a className="textLink" href={txExplorerUrl} target="_blank" rel="noreferrer">
                View transaction in Hiro Explorer
              </a>
            ) : null}
          </section>
        </section>

        <section className="dashboardColumn">
          <TaskTreePanel taskTree={job?.taskTree} />
          <CommerceTracePanel commerceTrace={job?.commerceTrace} />
        </section>
      </main>

      <section className="bottomDeck">
        <div className="bottomDeckItem">
          {terminalEntries.length ? (
            <div className="traceCard">
              <div className="traceCardHeader">
                <div>
                  <p className="traceEyebrow">Runtime Log</p>
                  <h3>Operator-visible execution notes</h3>
                </div>
              </div>
              <div className="terminalLog">
                {terminalEntries.map((entry) => (
                  <div key={entry.id} className={`terminalLine terminalLine-${entry.tone}`}>
                    <span className="terminalDot" />
                    <p>{entry.message}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="traceCard">
              <div className="traceCardHeader">
                <div>
                  <p className="traceEyebrow">Runtime Log</p>
                  <h3>No activity yet</h3>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="bottomDeckItem">
          <OutputManifestPanel outputs={job?.outputs || job?.report?.outputs} />
        </div>
      </section>

      {(job?.status === 'preparing' || job?.status === 'processing' || backendWorkflowPending) && !hasReport ? (
        <div className="processingBanner">
          {job?.status === 'preparing'
            ? 'The manager molbot is preparing evidence and generating the payment quote.'
            : 'Paid specialists are running. The backend is packaging the dossier and agent handoff outputs.'}
        </div>
      ) : null}

      {!job ? null : !reportMarkdown && job.status !== 'preparing' && job.status !== 'processing' && job.status !== 'awaiting-payment' && !backendWorkflowPending ? (
        <div className="placeholderState reportPlaceholder">No report output yet.</div>
      ) : null}
    </div>
  );
}
