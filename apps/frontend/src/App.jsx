import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const DEMO_PAYMENT_TOKEN = 'demo-paid-token';

const TOPIC_PRESETS = [
  '我想知道最近的关于solidity漏洞的文章',
  'x402 payment gate 对 agent service monetization 的意义是什么？',
  'Stacks settlement 在 agentic commerce 里的优缺点有哪些？',
  '对比 Solidity 常见重入漏洞与访问控制漏洞的研究现状'
];

const JUDGE_CRITERIA = [
  { key: 'innovation', title: 'Innovation', description: 'Treats x402 as a machine-readable capability unlock for molbots rather than a web-only paywall.' },
  { key: 'technical', title: 'Technical depth', description: 'Shows pricing, settlement, invoice state, entitlement release, and multi-agent orchestration as one protocol.' },
  { key: 'stacks', title: 'Stacks alignment', description: 'Centers STX, sBTC, USDCx, and Clarity invoice semantics in the architecture.' },
  { key: 'ux', title: 'User experience', description: 'Humans see a clean dossier while molbots get explicit protocol semantics.' },
  { key: 'impact', title: 'Impact potential', description: 'Can expand from paid reports into a wider machine-to-machine service economy.' }
];

const CHALLENGE_FIELDS = ['service', 'price', 'asset', 'recipient', 'capability', 'expiry', 'invoiceId'];
const INVOICE_FIELDS = ['invoiceId', 'payer', 'recipient', 'asset', 'amount', 'status', 'createdAt', 'consumedAt'];
const ENTITLEMENT_FIELDS = ['capability', 'scope', 'downloadRights', 'delegationRights', 'replayPolicy', 'proofOfPayment'];

const NEGOTIATION_FLOW = [
  'Requester molbot discovers a specialist service.',
  'Specialist returns x402 challenge + capability terms.',
  'Requester chooses STX / sBTC / USDCx settlement rail.',
  'Clarity invoice moves from created to paid.',
  'Capability entitlement is released to the buyer.',
  'If redeemed, invoice moves to consumed to prevent replay.'
];

function buildPayloadExamples(job) {
  const invoiceId = job?.paymentReceipt?.invoiceId || job?.paymentRequest?.invoiceId || 'inv_demo_001';
  const asset = job?.paymentRequest?.asset || 'STX';
  const contract = job?.paymentRequest?.stacks?.contract || 'autoscholar-payments.clar';
  return {
    challenge: {
      service: 'premium-research-dossier',
      price: '0.10',
      asset,
      recipient: 'autoscholar-service-principal',
      capability: 'premium-report',
      expiry: '2026-03-31T23:59:59Z',
      invoiceId
    },
    invoice: {
      invoiceId,
      payer: 'molbot-buyer',
      recipient: 'autoscholar-service-principal',
      asset,
      amount: '0.10',
      status: job?.contractState?.invoiceStatus || 'created',
      createdAt: '2026-03-12T20:00:00Z',
      consumedAt: job?.contractState?.invoiceStatus === 'consumed' ? '2026-03-12T20:05:00Z' : null,
      contract
    },
    entitlement: {
      capability: 'premium-report',
      scope: 'single dossier unlock',
      downloadRights: true,
      delegationRights: false,
      replayPolicy: 'consume-on-redeem',
      proofOfPayment: job?.paymentReceipt?.txid || 'demo-payment-proof'
    }
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function StatusPill({ status }) {
  if (!status) return <span className="status status-idle">idle</span>;
  return <span className={`status status-${status}`}>{String(status).replaceAll('_', ' ')}</span>;
}

function StatTile({ label, value, tone = 'default' }) {
  return <div className={`statTile statTile-${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function JudgeCard({ title, description }) {
  return <article className="judgeCard miniPanel"><p className="panelKicker">Judge signal</p><h3>{title}</h3><p>{description}</p></article>;
}

function AlignmentRow({ label, value, strong = false }) {
  return <div className="alignmentRow"><span>{label}</span><strong className={strong ? 'is-strong' : ''}>{value}</strong></div>;
}

function SpecCard({ title, kicker, fields, accent }) {
  return (
    <article className={`specCard miniPanel ${accent ? 'specCardAccent' : ''}`}>
      <p className="panelKicker">{kicker}</p>
      <h3>{title}</h3>
      <div className="specFields">
        {fields.map((field) => <span key={field} className="specField">{field}</span>)}
      </div>
    </article>
  );
}

export default function App() {
  const [topic, setTopic] = useState('我想知道最近的关于solidity漏洞的文章');
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function createJob(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const created = await request('/api/research', { method: 'POST', body: JSON.stringify({ topic }) });
      setJob(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function payAndComplete() {
    if (!job?.id) return;
    setLoading(true);
    setError('');
    try {
      const completed = await request(`/api/jobs/${job.id}/pay`, {
        method: 'POST',
        headers: { 'x-payment-token': DEMO_PAYMENT_TOKEN },
        body: JSON.stringify({ paymentToken: DEMO_PAYMENT_TOKEN })
      });
      setJob(completed);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function consumeEntitlement() {
    if (!job?.id) return;
    setLoading(true);
    setError('');
    try {
      await request(`/api/jobs/${job.id}/consume`, { method: 'POST' });
      const refreshed = await request(`/api/jobs/${job.id}`);
      setJob(refreshed);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const reportMarkdown = job?.report?.markdown?.trim();
  const topicLength = topic.trim().length;
  const hasReport = Boolean(job?.report);

  const timeline = useMemo(() => {
    const currentStatus = job?.status;
    return [
      { key: 'draft', title: 'Draft topic', description: 'Define the research question and scope.', active: topicLength > 0 && !job, complete: Boolean(job) },
      { key: 'awaiting-payment', title: 'Payment gate', description: 'The premium dossier waits behind x402 unlock.', active: currentStatus === 'awaiting-payment', complete: currentStatus === 'completed' || currentStatus === 'completed_with_fallback' },
      { key: 'completed', title: 'Read dossier', description: 'The final report is unlocked and rendered below.', active: currentStatus === 'completed' || currentStatus === 'completed_with_fallback', complete: currentStatus === 'completed' || currentStatus === 'completed_with_fallback' }
    ];
  }, [job, topicLength]);

  const summaryStats = useMemo(() => ({
    mode: job?.researchMode || 'analysis',
    papers: job?.papers?.length || 0,
    paymentEvidence: job?.paymentEvidence?.length || 0,
    status: job?.status || 'idle'
  }), [job]);

  const stacksSummary = useMemo(() => {
    const payment = job?.paymentRequest;
    const stacks = payment?.stacks;
    return {
      network: stacks?.network || 'testnet scaffold',
      asset: payment?.asset || 'STX / sBTC / USDCx-ready',
      contract: stacks?.contract || 'autoscholar-payments.clar',
      unlock: payment?.type || 'x402 capability unlock'
    };
  }, [job]);

  const judgeReadiness = useMemo(() => {
    if (!job) return 'concept-ready';
    if (job.status === 'completed' || job.status === 'completed_with_fallback') return 'demo-proven';
    if (job.status === 'awaiting-payment') return 'flow-proven';
    return 'in-progress';
  }, [job]);

  const reportMeta = useMemo(() => ({
    synthesisMode: job?.report?.quality?.synthesisMode || job?.llm?.mode || 'unknown',
    confidence: job?.report?.quality?.confidence || 'unknown',
    contractState: job?.contractState?.invoiceStatus || 'created'
  }), [job]);

  const payloadExamples = useMemo(() => buildPayloadExamples(job), [job]);

  return (
    <div className="page">
      <div className="pageGlow pageGlowA" aria-hidden="true" />
      <div className="pageGlow pageGlowB" aria-hidden="true" />

      <header className="topbar panelLite" aria-label="Application header">
        <div className="brandLockup">
          <span className="brandMark" aria-hidden="true">◈</span>
          <div>
            <p className="brandName">AutoScholar V8.3</p>
            <p className="brandSub">Protocol spec + planner-reviewed research synthesis</p>
          </div>
        </div>
        <div className="topbarMeta">
          <span className="badge">Hackathon judge mode</span>
          <StatusPill status={job?.status} />
        </div>
      </header>

      <section className="heroSplit panel">
        <div className="heroMain stack-lg">
          <div className="heroHead stack-sm">
            <span className="eyebrow">Agentic commerce on Stacks</span>
            <h1>A protocol spec for molbots that pay, get paid, and unlock capabilities.</h1>
            <p className="heroText">
              V8.3 moves from protocol storytelling to protocol specification. It shows how x402 challenge payloads, Clarity invoice state,
              capability entitlements, and planner-reviewed report generation can work together as a real molbot commerce rail.
            </p>
          </div>
          <div className="statsGrid" aria-label="Current summary stats">
            <StatTile label="Research mode" value={summaryStats.mode} tone="accent" />
            <StatTile label="Topic evidence" value={String(summaryStats.papers)} />
            <StatTile label="Synthesis mode" value={reportMeta.synthesisMode} />
            <StatTile label="Judge readiness" value={judgeReadiness} tone="warn" />
          </div>
        </div>

        <aside className="heroRail panelInset">
          <div className="sectionTitleRow"><div><p className="panelKicker">Workflow state</p><h2>Current path</h2></div></div>
          <ol className="timeline">
            {timeline.map((item, index) => (
              <li key={item.key} className={`timelineItem ${item.active ? 'is-active' : ''} ${item.complete ? 'is-complete' : ''}`}>
                <div className="timelineMarker" aria-hidden="true"><span>{index + 1}</span></div>
                <div><h3>{item.title}</h3><p>{item.description}</p></div>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <section className="judgeBoard panel">
        <div className="sectionHeader sectionHeader-start judgeBoardHeader">
          <div><p className="panelKicker">Judge-facing framing</p><h2>How V8.3 maps to the hackathon scorecard</h2></div>
          <p className="helperText judgeBoardHint">This version makes the protocol semantics and the report-generation rigor more legible.</p>
        </div>
        <div className="judgeGrid">{JUDGE_CRITERIA.map((item) => <JudgeCard key={item.key} title={item.title} description={item.description} />)}</div>
      </section>

      <section className="specBoard panel">
        <div className="sectionHeader sectionHeader-start judgeBoardHeader">
          <div><p className="panelKicker">Protocol specification</p><h2>x402 challenge schema, invoice schema, and entitlement schema</h2></div>
          <p className="helperText judgeBoardHint">The point is to show protocol-level thinking, not only product mockups.</p>
        </div>

        <div className="specGrid">
          <SpecCard title="x402 challenge schema" kicker="Pricing envelope" fields={CHALLENGE_FIELDS} accent />
          <SpecCard title="Invoice state schema" kicker="Clarity lifecycle" fields={INVOICE_FIELDS} />
          <SpecCard title="Capability entitlement schema" kicker="Post-payment rights" fields={ENTITLEMENT_FIELDS} />
        </div>

        <div className="sequencePanel panelInset">
          <p className="panelKicker">Negotiation + settlement sequence</p>
          <ol className="sequenceList">
            {NEGOTIATION_FLOW.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </div>

        <div className="payloadGrid">
          <article className="miniPanel payloadCard">
            <p className="panelKicker">Example x402 challenge</p>
            <pre className="payloadPre">{JSON.stringify(payloadExamples.challenge, null, 2)}</pre>
          </article>
          <article className="miniPanel payloadCard">
            <p className="panelKicker">Example invoice object</p>
            <pre className="payloadPre">{JSON.stringify(payloadExamples.invoice, null, 2)}</pre>
          </article>
          <article className="miniPanel payloadCard">
            <p className="panelKicker">Example entitlement object</p>
            <pre className="payloadPre">{JSON.stringify(payloadExamples.entitlement, null, 2)}</pre>
          </article>
        </div>
      </section>

      <main className="workspaceGrid workspaceGridV8">
        <section className="panel composerCard" aria-labelledby="compose-heading">
          <div className="sectionHeader sectionHeader-start">
            <div><p className="panelKicker">Compose query</p><h2 id="compose-heading">Frame the research question</h2></div>
            <div className="counterGroup"><span className="counterChip">{topicLength} chars</span></div>
          </div>

          <div className="presetRow" aria-label="Suggested topics">
            {TOPIC_PRESETS.map((preset) => (
              <button key={preset} type="button" className={`presetChip ${topic === preset ? 'is-active' : ''}`} onClick={() => setTopic(preset)}>{preset}</button>
            ))}
          </div>

          <form onSubmit={createJob} className="stack-lg">
            <label className="fieldLabel" htmlFor="topic-input">Research brief</label>
            <textarea id="topic-input" value={topic} onChange={(e) => setTopic(e.target.value)} rows={8} placeholder="Ask for recent Solidity vulnerabilities, x402 payment design tradeoffs, or Stacks settlement architecture…" />
            <div className="actionRow">
              <button className="primaryButton" disabled={loading}>{loading ? 'Working…' : 'Create research job'}</button>
              <p className="helperText">API base: {API_BASE || 'same-origin /api proxy'}</p>
            </div>
          </form>

          {error ? <p className="error" role="alert">{error}</p> : null}

          <div className="subgrid">
            <article className="miniPanel infoPanel">
              <p className="panelKicker">Planner-reviewed report path</p>
              <ul className="list compact">
                <li>Outline planner defines section goals before long-form writing</li>
                <li>Reviewer checks evidence strength, overclaims, and missing sections</li>
                <li>Final writer produces markdown dossier using the reviewed plan</li>
                <li>Fallback still returns structured literature-style output</li>
              </ul>
            </article>
            <article className="miniPanel infoPanel">
              <p className="panelKicker">Why judges should care</p>
              <ul className="list compact">
                <li>Protocol semantics are explicit enough for future wallet and molbot integration.</li>
                <li>Report quality now depends on process rigor, not one lucky generation.</li>
                <li>Capability unlock semantics are visible and composable.</li>
                <li>The same rail can support research, shopping, and specialist skill commerce.</li>
              </ul>
            </article>
          </div>
        </section>

        <aside className="panel stacksCard" aria-labelledby="stacks-heading">
          <div className="sectionHeader sectionHeader-start">
            <div><p className="panelKicker">Stacks alignment</p><h2 id="stacks-heading">Protocol proof panel</h2></div>
            <span className="badge badgeStacks">Stacks-native hooks</span>
          </div>

          <div className="stack-lg">
            <div className="miniPanel alignmentPanel">
              <AlignmentRow label="Settlement network" value={stacksSummary.network} strong />
              <AlignmentRow label="Unlock primitive" value={stacksSummary.unlock} />
              <AlignmentRow label="Settlement asset" value={stacksSummary.asset} />
              <AlignmentRow label="Clarity contract" value={stacksSummary.contract} />
            </div>
            <div className="miniPanel lifecyclePanel">
              <p className="panelKicker">Invoice lifecycle</p>
              <div className="lifecycleTrack">
                <span className="lifecycleStep is-active">created</span>
                <span className="lifecycleArrow">→</span>
                <span className={`lifecycleStep ${job?.paymentReceipt ? 'is-active' : ''}`}>paid</span>
                <span className="lifecycleArrow">→</span>
                <span className={`lifecycleStep ${reportMeta.contractState === 'consumed' ? 'is-active' : ''}`}>consumed</span>
              </div>
            </div>
            <div className="miniPanel">
              <p className="panelKicker">Report QA meta</p>
              <AlignmentRow label="Synthesis mode" value={reportMeta.synthesisMode} />
              <AlignmentRow label="Confidence" value={reportMeta.confidence} />
              <AlignmentRow label="Payment evidence" value={String(summaryStats.paymentEvidence)} />
            </div>
          </div>
        </aside>

        <section className="panel reportCard" aria-labelledby="report-heading">
          <div className="sectionHeader sectionHeader-start">
            <div><p className="panelKicker">Output view</p><h2 id="report-heading">Research dossier</h2></div>
            <StatusPill status={job?.status} />
          </div>

          {!job ? (
            <div className="emptyState panelInset"><div className="emptyOrb" aria-hidden="true" /><h3>No active dossier</h3><p>Submit a topic on the left. Once the research job is created, this panel becomes the active dossier view.</p></div>
          ) : (
            <div className="stack-lg">
              <div className="jobMetaGrid">
                <div className="miniPanel"><p className="panelKicker">Job id</p><p className="monoText">{job.id || 'pending'}</p></div>
                <div className="miniPanel"><p className="panelKicker">Research mode</p><p>{job.researchMode || 'analysis'}</p></div>
                <div className="miniPanel"><p className="panelKicker">Topic evidence</p><p>{job.papers?.length || 0}</p></div>
              </div>

              <div className="miniPanel topicBanner"><p className="panelKicker">Topic</p><p>{job.topic}</p></div>

              {job.status === 'awaiting-payment' ? (
                <div className="unlockCard panelInset">
                  <div className="unlockHeader"><div><p className="panelKicker">Payment required</p><h3>Unlock the premium dossier</h3></div><span className="tokenPill">x402 gate</span></div>
                  <p>{job.paymentRequest?.reason || 'Payment is required before the report can be revealed.'}</p>
                  <button className="primaryButton" onClick={payAndComplete} disabled={loading}>{loading ? 'Processing payment…' : 'Unlock report'}</button>
                </div>
              ) : null}

              {hasReport ? (
                <article className="reportBody panelInset stack-lg">
                  <div className="reportLead"><div><p className="panelKicker">Unlocked markdown</p><p className="reportTopic">{job.topic}</p></div><div className="reportHint">Planner → reviewer → final writer dossier path</div></div>
                  <div className="entitlementBar">
                    <div>
                      <p className="panelKicker">Entitlement state</p>
                      <p className="reportHint">Current invoice state: {reportMeta.contractState}</p>
                    </div>
                    <button
                      type="button"
                      className="secondaryButton"
                      onClick={consumeEntitlement}
                      disabled={loading || reportMeta.contractState === 'consumed'}
                    >
                      {reportMeta.contractState === 'consumed' ? 'Entitlement consumed' : 'Consume entitlement'}
                    </button>
                  </div>
                  {reportMarkdown ? <div className="markdownReport"><ReactMarkdown remarkPlugins={[remarkGfm]}>{reportMarkdown}</ReactMarkdown></div> : <p className="muted">The report content is not available yet.</p>}
                </article>
              ) : (
                <div className="emptyState panelInset emptyStateCompact"><h3>Report not revealed yet</h3><p>The job exists, but the dossier content is still waiting for the next workflow step.</p></div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
