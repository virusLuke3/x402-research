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
  { key: 'innovation', title: 'Innovation', description: 'Treats HTTP 402 as a machine-readable capability unlock for molbots, not a web-only payment primitive.' },
  { key: 'technical', title: 'Technical depth', description: 'Combines retrieval, multi-agent synthesis, capability pricing, entitlement release, and settlement semantics.' },
  { key: 'stacks', title: 'Stacks alignment', description: 'Positions STX, sBTC, USDCx, and Clarity invoice state as first-class rails in the protocol story.' },
  { key: 'ux', title: 'User experience', description: 'Humans see a clean dossier flow; molbots can still interpret pricing, unlock, and delivery semantics.' },
  { key: 'impact', title: 'Impact potential', description: 'Extends from one research product into a wider machine-to-machine commerce network.' }
];

const ASSET_RAILS = [
  { asset: 'STX', useCase: 'Low-friction default unlocks', why: 'Best for native Stacks-denominated service access and simple settlement.' },
  { asset: 'sBTC', useCase: 'High-trust, Bitcoin-aligned premium services', why: 'Strong narrative fit for high-value machine commerce and treasury alignment.' },
  { asset: 'USDCx', useCase: 'Stable pricing for specialist skills', why: 'Useful when molbots charge predictable prices for content, audits, or data services.' }
];

const NETWORK_NODES = [
  { title: 'Manager Molbot', type: 'Coordinator', detail: 'Decomposes demand, routes tasks, assembles paid outputs.' },
  { title: 'Security Analyst', type: 'Specialist', detail: 'Charges for exploit triage, audit synthesis, premium research.' },
  { title: 'Shopping Molbot', type: 'Executor', detail: 'Can shop, procure tools, or perform budgeted agent tasks.' },
  { title: 'Content Forge', type: 'Specialist', detail: 'Sells premium content and structured long-form artifacts.' },
  { title: 'x402 Challenge', type: 'Protocol', detail: 'Encodes price, asset, capability, recipient, and unlock terms.' },
  { title: 'Clarity Invoice State', type: 'Settlement', detail: 'Tracks created → paid → consumed lifecycle on Stacks-style semantics.' }
];

const ENTITLEMENTS = [
  'premium-report',
  'delegated-skill-call',
  'downloadable-artifact',
  'specialist-transcript',
  'automation-rights'
];

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
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

  return (
    <div className="page">
      <div className="pageGlow pageGlowA" aria-hidden="true" />
      <div className="pageGlow pageGlowB" aria-hidden="true" />

      <header className="topbar panelLite" aria-label="Application header">
        <div className="brandLockup">
          <span className="brandMark" aria-hidden="true">◈</span>
          <div>
            <p className="brandName">AutoScholar V8.2</p>
            <p className="brandSub">Protocol architecture for molbot-to-molbot commerce</p>
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
            <h1>A protocol where molbots discover, price, settle, and release skills.</h1>
            <p className="heroText">
              V8.2 pushes beyond UI storytelling into protocol architecture: manager molbots route tasks to specialists,
              x402 carries machine-readable pricing and entitlement terms, and Stacks-flavored settlement semantics anchor created → paid → consumed delivery.
            </p>
          </div>
          <div className="statsGrid" aria-label="Current summary stats">
            <StatTile label="Research mode" value={summaryStats.mode} tone="accent" />
            <StatTile label="Topic evidence" value={String(summaryStats.papers)} />
            <StatTile label="Payment evidence" value={String(summaryStats.paymentEvidence)} />
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
          <div><p className="panelKicker">Judge-facing framing</p><h2>How V8.2 maps to the hackathon scorecard</h2></div>
          <p className="helperText judgeBoardHint">This version is optimized to show protocol thinking, asset rails, and high-quality report output together.</p>
        </div>
        <div className="judgeGrid">{JUDGE_CRITERIA.map((item) => <JudgeCard key={item.key} title={item.title} description={item.description} />)}</div>
      </section>

      <section className="architectureBoard panel">
        <div className="sectionHeader sectionHeader-start judgeBoardHeader">
          <div><p className="panelKicker">Protocol architecture</p><h2>Molbot network, asset rails, and capability entitlements</h2></div>
          <p className="helperText judgeBoardHint">The goal is to make the protocol legible: who pays whom, for what, on which rail, and what gets unlocked.</p>
        </div>

        <div className="architectureGrid">
          <div className="panelInset networkPanel">
            <p className="panelKicker">Network topology</p>
            <div className="nodeGrid">
              {NETWORK_NODES.map((node) => (
                <article key={node.title} className="nodeCard">
                  <span className="nodeType">{node.type}</span>
                  <h3>{node.title}</h3>
                  <p>{node.detail}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="panelInset railsPanel">
            <p className="panelKicker">Asset strategy</p>
            <div className="railsList">
              {ASSET_RAILS.map((rail) => (
                <div key={rail.asset} className="railRow">
                  <strong>{rail.asset}</strong>
                  <div>
                    <p>{rail.useCase}</p>
                    <span>{rail.why}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panelInset entitlementsPanel">
            <p className="panelKicker">Capability entitlements</p>
            <div className="entitlementChips">
              {ENTITLEMENTS.map((item) => <span key={item} className="entitlementChip">{item}</span>)}
            </div>
            <p className="entitlementCopy">x402 is presented here as a machine-readable entitlement layer: after payment, the buyer molbot receives explicit rights to premium outputs, delegated calls, or downloadable artifacts.</p>
          </div>
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
              <p className="panelKicker">Visible to user</p>
              <ul className="list compact">
                <li>Topic metadata and workflow status</li>
                <li>x402 payment checkpoint</li>
                <li>Unlocked markdown dossier</li>
                <li>References and supporting evidence</li>
              </ul>
            </article>
            <article className="miniPanel infoPanel">
              <p className="panelKicker">Report quality upgrades</p>
              <ul className="list compact">
                <li>Stronger report synthesis prompt inspired by structured literature-review systems</li>
                <li>Explicit core-literature analysis, not only a short summary</li>
                <li>More emphasis on evidence strength, gaps, and implementation guidance</li>
                <li>Better fallback markdown when full synthesis is unavailable</li>
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
              <p className="panelKicker">Clarity invoice lifecycle</p>
              <div className="lifecycleTrack">
                <span className="lifecycleStep is-active">created</span>
                <span className="lifecycleArrow">→</span>
                <span className={`lifecycleStep ${job?.paymentReceipt ? 'is-active' : ''}`}>paid</span>
                <span className="lifecycleArrow">→</span>
                <span className={`lifecycleStep ${job?.paymentReceipt?.invoiceStatus === 'consumed' ? 'is-active' : ''}`}>consumed</span>
              </div>
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
                  <div className="reportLead"><div><p className="panelKicker">Unlocked markdown</p><p className="reportTopic">{job.topic}</p></div><div className="reportHint">Structured dossier with stronger literature-style synthesis</div></div>
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
