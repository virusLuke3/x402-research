import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { request as walletRequest } from '@stacks/connect';
import { Cl, Pc } from '@stacks/transactions';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const STACKS_NETWORK = 'testnet';
const TX_POLL_INTERVAL_MS = 4000;
const TX_POLL_MAX_ATTEMPTS = 40;
const TX_EXPLORER_BASE = 'https://explorer.hiro.so/txid';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
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
  const label = status ? String(status).replaceAll('_', ' ') : 'idle';
  return <span className={`statusPill status-${status || 'idle'}`}>{label}</span>;
}

function DetailRow({ label, value, mono = false }) {
  return (
    <div className="detailRow">
      <span>{label}</span>
      <strong className={mono ? 'monoText' : ''}>{value}</strong>
    </div>
  );
}

export default function App() {
  const [topic, setTopic] = useState('我想知道最近的关于solidity漏洞的文章');
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [walletStatus, setWalletStatus] = useState('disconnected');
  const [paymentReadiness, setPaymentReadiness] = useState(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [executionLog, setExecutionLog] = useState([]);
  const [paymentTxid, setPaymentTxid] = useState('');
  const [verificationDetails, setVerificationDetails] = useState(null);

  useEffect(() => {
    refreshPaymentReadiness({ silent: false }).catch(() => undefined);
  }, []);

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
    pushExecutionEvent('Submitting research task to the manager agent', 'info');

    try {
      const created = await request('/api/research', {
        method: 'POST',
        body: JSON.stringify({ topic })
      });
      setJob(created);
      pushExecutionEvent(`Evidence scan complete: ${created?.papers?.length || 0} sources prepared`, 'success');
      pushExecutionEvent('x402 payment challenge created. Payment is required before premium synthesis.', 'muted');
    } catch (err) {
      const message = formatErrorMessage(err);
      setError(message);
      pushExecutionEvent(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function connectWallet(forceWalletSelect = true) {
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
      pushExecutionEvent('Connecting Leather wallet', 'info');
      await connectWallet(true);
    } catch (err) {
      const message = formatErrorMessage(err);
      setError(message);
      pushExecutionEvent(message, 'error');
      setWalletStatus('disconnected');
    }
  }

  function buildContractCallArgs(paymentRequest) {
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

  async function waitForTxSuccess(txid, apiBase, onUpdate) {
    for (let attempt = 0; attempt < TX_POLL_MAX_ATTEMPTS; attempt += 1) {
      const response = await fetch(`${apiBase}/extended/v1/tx/${txid}`);
      if (!response.ok) {
        throw new Error(`Failed to inspect transaction ${txid}`);
      }
      const tx = await response.json();
      onUpdate?.(tx, attempt + 1);
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
      await new Promise((resolve) => window.setTimeout(resolve, TX_POLL_INTERVAL_MS));
    }
    throw new Error('Timed out waiting for transaction confirmation');
  }

  async function ensureContractDeployed(contractPrincipal, apiBase) {
    const [address, contractName] = String(contractPrincipal || '').split('.');
    if (!address || !contractName) {
      throw new Error('Invalid Stacks contract principal');
    }
    const response = await fetch(`${apiBase}/v2/contracts/source/${address}/${contractName}`);
    if (!response.ok) {
      throw new Error('Stacks testnet contract is not deployed yet. Deploy autoscholar-payments and set STACKS_PAYMENT_CONTRACT first.');
    }
  }

  async function payAndComplete() {
    if (!job?.id) return;
    setLoading(true);
    setError('');
    setVerificationDetails(null);
    setPaymentTxid('');

    try {
      const readiness = await refreshPaymentReadiness({ silent: true });
      if (readiness?.missing?.length) {
        throw new Error(`Payment rail is not ready: missing ${readiness.missing.join(', ')}`);
      }
      if (!readiness?.contract?.deployed) {
        throw new Error('Stacks testnet contract is not deployed yet. Deploy autoscholar-payments and update STACKS_PAYMENT_CONTRACT first.');
      }

      const sender = walletAddress || await connectWallet(false).catch(() => connectWallet(true));
      pushExecutionEvent(`Using sender ${shortAddress(sender)} on ${STACKS_NETWORK}`, 'info');

      const paymentRequest = job.paymentRequest;
      const contractId = paymentRequest?.clarity?.contractPrincipal;
      if (!contractId || !contractId.includes('.')) {
        throw new Error('Stacks contract principal is not configured');
      }

      await ensureContractDeployed(contractId, paymentRequest?.stacks?.apiBase || 'https://api.testnet.hiro.so');
      pushExecutionEvent(`Contract ready: ${contractId}`, 'success');

      const postConditions = paymentRequest?.asset === 'STX'
        ? [Pc.principal(sender).willSendEq(BigInt(String(paymentRequest.amount))).ustx()]
        : [];

      setWalletStatus('signing');
      pushExecutionEvent(`Waiting for Leather to sign ${paymentRequest?.stacks?.displayAmount || `${paymentRequest.amount} ${paymentRequest.asset}`}`, 'info');

      const txResult = await walletRequest(
        { forceWalletSelect: false, persistWalletSelect: true, enableLocalStorage: true },
        'stx_callContract',
        {
          contract: contractId,
          functionName: paymentRequest?.clarity?.publicFunction || 'pay-invoice',
          functionArgs: buildContractCallArgs(paymentRequest),
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
        paymentRequest?.stacks?.apiBase || 'https://api.testnet.hiro.so',
        (tx, attempt) => {
          const tone = tx?.tx_status === 'success' ? 'success' : 'info';
          pushExecutionEvent(`Hiro poll #${attempt}: ${tx?.tx_status || 'unknown'}`, tone);
        }
      );

      setWalletStatus('verifying');
      pushExecutionEvent('Payment confirmed on Hiro. Submitting proof to backend and starting agent workflow.', 'info');

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
      if (completed?.status === 'completed_with_fallback') {
        pushExecutionEvent('Payment verified, but report fell back to degraded synthesis.', 'warn');
      } else {
        pushExecutionEvent('Payment verified. Agent workflow completed and report unlocked.', 'success');
      }
      setWalletStatus('connected');
    } catch (err) {
      setVerificationDetails(err?.responseData?.verification || null);
      const message = formatErrorMessage(err);
      setError(message);
      pushExecutionEvent(message, 'error');
      setWalletStatus(walletAddress ? 'connected' : 'disconnected');
    } finally {
      setLoading(false);
    }
  }

  const reportMarkdown = job?.report?.markdown?.trim();
  const hasReport = Boolean(job?.report);
  const paymentStatus = job?.paymentReceipt
    ? 'paid'
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
  const walletReady = walletStatus === 'connected' && walletAddress;
  const unlockLabel = walletReady
    ? `Sign & Pay ${displayAmount} to Unlock Agent Data`
    : `Connect Leather Wallet`;

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

    if (job?.status === 'awaiting-payment' && !job?.paymentReceipt) {
      entries.push({
        id: 'job-locked',
        message: `Awaiting x402 payment to unlock premium research synthesis for ${displayAmount}`,
        tone: 'muted'
      });
    }

    if (job?.status === 'completed' && hasReport) {
      entries.push({
        id: 'job-ready',
        message: 'Final report ready for review',
        tone: 'success'
      });
    }

    if (job?.status === 'completed_with_fallback') {
      entries.push({
        id: 'job-fallback',
        message: 'Workflow completed with fallback synthesis',
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
  }, [displayAmount, executionLog, hasReport, job]);

  return (
    <div className="appShell">
      <header className="appHeader">
        <div>
          <p className="appEyebrow">AutoScholar</p>
          <h1>x402-powered agent research</h1>
        </div>
        <div className="headerMeta">
          <span className="headerMetaItem">{walletAddress ? shortAddress(walletAddress) : 'Wallet not connected'}</span>
          <StatusPill status={job?.status} />
        </div>
      </header>

      <main className="workspaceGrid">
        <section className="workspaceCard">
          <div className="cardHeader">
            <div>
              <p className="cardEyebrow">Column 1</p>
              <h2>Research Task</h2>
            </div>
            <span className="cardHint">{API_BASE || '/api proxy'}</span>
          </div>

          <p className="cardCopy">
            Describe the research question. The system will scan evidence first, then gate premium synthesis behind x402 payment.
          </p>

          <form onSubmit={createJob} className="queryForm">
            <textarea
              id="topic-input"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              rows={10}
              placeholder="Describe the research topic you want the agent to investigate..."
            />
            <button className="primaryButton" disabled={loading}>
              {loading && !canPay ? 'Scanning...' : 'Submit Research Task'}
            </button>
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
              </div>
            </div>
          ) : (
            <div className="placeholderState">
              Submit a topic to create an agent task and generate an x402 payment challenge.
            </div>
          )}
        </section>

        <section className="workspaceCard">
          <div className="cardHeader">
            <div>
              <p className="cardEyebrow">Column 2</p>
              <h2>Payment Gateway</h2>
            </div>
            <StatusPill status={paymentStatus} />
          </div>

          <p className="cardCopy">
            This card merges the x402 payment details and Leather wallet actions into one focused payment flow.
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
                <p>{walletAddress ? 'Wallet connected and ready for testnet signing.' : 'Connect a Stacks testnet wallet to continue.'}</p>
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
            disabled={loading || !job}
          >
            {canPay ? unlockLabel : 'Create a research task before payment'}
          </button>

          <div className="gatewayNotes">
            {paymentReadiness?.warnings?.map((warning) => (
              <p key={warning} className="notice noticeWarn">{warning}</p>
            ))}
            {paymentReadiness?.missing?.map((missing) => (
              <p key={missing} className="notice noticeError">Missing configuration: {missing}</p>
            ))}
            {!job ? (
              <p className="notice noticeMuted">No active task yet. Submit a topic first, then sign the payment request.</p>
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

        <section className="workspaceCard terminalColumn">
          <div className="cardHeader">
            <div>
              <p className="cardEyebrow">Column 3</p>
              <h2>Agent Terminal</h2>
            </div>
            <span className="cardHint">{hasReport ? 'Result Output' : 'Execution Log'}</span>
          </div>

          {!job ? (
            <div className="terminalLocked">
              Awaiting a research task. Submit a topic to initialize the agent workflow.
            </div>
          ) : (
            <div className="terminalStack">
              {job.status === 'awaiting-payment' && !job.paymentReceipt ? (
                <div className="terminalLocked">
                  Awaiting x402 payment to fetch premium research materials and unlock agent synthesis.
                </div>
              ) : null}

              {terminalEntries.length ? (
                <div className="terminalLog">
                  {terminalEntries.map((entry) => (
                    <div key={entry.id} className={`terminalLine terminalLine-${entry.tone}`}>
                      <span className="terminalDot" />
                      <p>{entry.message}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {job.status === 'processing' && !hasReport ? (
                <div className="processingState">
                  Agent workflow is running. The backend is synthesizing the final report.
                </div>
              ) : null}

              {reportMarkdown ? (
                <article className="reportCard">
                  <div className="reportHeader">
                    <h3>Research Report</h3>
                    <StatusPill status={job.status} />
                  </div>
                  <div className="markdownReport">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{reportMarkdown}</ReactMarkdown>
                  </div>
                </article>
              ) : null}

              {!reportMarkdown && job.status !== 'processing' && job.status !== 'awaiting-payment' ? (
                <div className="placeholderState">No report output yet.</div>
              ) : null}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
