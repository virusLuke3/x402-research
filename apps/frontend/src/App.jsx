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
  {
    key: 'innovation',
    title: 'Innovation',
    description: 'Turns HTTP 402 into a machine-payable research unlock, instead of another generic chat wrapper.'
  },
  {
    key: 'technical',
    title: 'Technical depth',
    description: 'Combines retrieval, multi-agent synthesis, markdown dossier generation, and payment-gated capability release.'
  },
  {
    key: 'stacks',
    title: 'Stacks alignment',
    description: 'Surfaces Clarity contract flow, testnet settlement semantics, STX / sBTC / USDCx positioning, and stacks-style verification.'
  },
  {
    key: 'ux',
    title: 'User experience',
    description: 'Topic → unlock → readable dossier. No prompt leakage, no tool spam, no chain complexity dumped on the user.'
  },
  {
    key: 'impact',
    title: 'Impact potential',
    description: 'Useful as a premium research primitive for Stacks-native apps, agents, and developer tooling.'
  }
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
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function StatusPill({ status }) {
  if (!status) return <span className="status status-idle">idle</span>;
  return <span className={`status status-${status}`}>{String(status).replaceAll('_', ' ')}</span>;
}

function StatTile({ label, value, tone = 'default' }) {
  return (
    <div className={`statTile statTile-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function JudgeCard({ title, description }) {
  return (
    <article className="judgeCard miniPanel">
      <p className="panelKicker">Judge signal</p>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
}

function AlignmentRow({ label, value, strong = false }) {
  return (
    <div className="alignmentRow">
      <span>{label}</span>
      <strong className={strong ? 'is-strong' : ''}>{value}</strong>
    </div>
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
      const created = await request('/api/research', {
        method: 'POST',
        body: JSON.stringify({ topic })
      });
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
        headers: {
          'x-payment-token': DEMO_PAYMENT_TOKEN
        },
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
      {
        key: 'draft',
        title: 'Draft topic',
        description: 'Define the research question and scope.',
        active: topicLength > 0 && !job,
        complete: Boolean(job)
      },
      {
        key: 'awaiting-payment',
        title: 'Payment gate',
        description: 'The premium dossier waits behind x402 unlock.',
        active: currentStatus === 'awaiting-payment',
        complete: currentStatus === 'completed' || currentStatus === 'completed_with_fallback'
      },
      {
        key: 'completed',
        title: 'Read dossier',
        description: 'The final report is unlocked and rendered below.',
        active: currentStatus === 'completed' || currentStatus === 'completed_with_fallback',
        complete: currentStatus === 'completed' || currentStatus === 'completed_with_fallback'
      }
    ];
  }, [job, topicLength]);

  const summaryStats = useMemo(() => {
    return {
      mode: job?.researchMode || 'analysis',
      papers: job?.papers?.length || 0,
      paymentEvidence: job?.paymentEvidence?.length || 0,
      status: job?.status || 'idle'
    };
  }, [job]);

  const stacksSummary = useMemo(() => {
    const payment = job?.paymentRequest;
    const stacks = payment?.stacks;
    return {
      network: stacks?.network || 'testnet scaffold',
      asset: payment?.asset || 'STX / USDCx / sBTC-ready',
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
            <p className="brandName">AutoScholar V8.0</p>
            <p className="brandSub">Stacks-aligned x402 research console</p>
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
            <span className="eyebrow">Premium research workflow</span>
            <h1>A Stacks-native research product, not just a research demo.</h1>
            <p className="heroText">
              AutoScholar V8.0 frames the project for judges: a payment-gated research engine where x402 handles capability unlocks,
              Stacks provides settlement semantics, Clarity models invoice state, and users receive a clean final dossier instead of raw agent chatter.
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
          <div className="sectionTitleRow">
            <div>
              <p className="panelKicker">Workflow state</p>
              <h2>Current path</h2>
            </div>
          </div>

          <ol className="timeline">
            {timeline.map((item, index) => (
              <li
                key={item.key}
                className={`timelineItem ${item.active ? 'is-active' : ''} ${item.complete ? 'is-complete' : ''}`}
              >
                <div className="timelineMarker" aria-hidden="true">
                  <span>{index + 1}</span>
                </div>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <section className="judgeBoard panel">
        <div className="sectionHeader sectionHeader-start judgeBoardHeader">
          <div>
            <p className="panelKicker">Judge-facing framing</p>
            <h2>How this version maps to the hackathon scorecard</h2>
          </div>
          <p className="helperText judgeBoardHint">Built to make innovation, Stacks alignment, and demo credibility legible in under one minute.</p>
        </div>

        <div className="judgeGrid">
          {JUDGE_CRITERIA.map((item) => (
            <JudgeCard key={item.key} title={item.title} description={item.description} />
          ))}
        </div>
      </section>

      <main className="workspaceGrid workspaceGridV8">
        <section className="panel composerCard" aria-labelledby="compose-heading">
          <div className="sectionHeader sectionHeader-start">
            <div>
              <p className="panelKicker">Compose query</p>
              <h2 id="compose-heading">Frame the research question</h2>
            </div>
            <div className="counterGroup">
              <span className="counterChip">{topicLength} chars</span>
            </div>
          </div>

          <div className="presetRow" aria-label="Suggested topics">
            {TOPIC_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`presetChip ${topic === preset ? 'is-active' : ''}`}
                onClick={() => setTopic(preset)}
              >
                {preset}
              </button>
            ))}
          </div>

          <form onSubmit={createJob} className="stack-lg">
            <label className="fieldLabel" htmlFor="topic-input">
              Research brief
            </label>
            <textarea
              id="topic-input"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={8}
              placeholder="Ask for recent Solidity vulnerabilities, x402 payment design tradeoffs, or Stacks settlement architecture…"
            />

            <div className="actionRow">
              <button className="primaryButton" disabled={loading}>
                {loading ? 'Working…' : 'Create research job'}
              </button>
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
              <p className="panelKicker">Intentionally hidden</p>
              <ul className="list compact">
                <li>Intermediate chain-of-thought</li>
                <li>Internal tool reasoning</li>
                <li>Prompt internals and diagnostics</li>
                <li>Noisy agent coordination traces</li>
              </ul>
            </article>
          </div>
        </section>

        <aside className="panel stacksCard" aria-labelledby="stacks-heading">
          <div className="sectionHeader sectionHeader-start">
            <div>
              <p className="panelKicker">Stacks alignment</p>
              <h2 id="stacks-heading">Protocol proof panel</h2>
            </div>
            <span className="badge badgeStacks">Stacks-native hooks</span>
          </div>

          <div className="stack-lg">
            <div className="miniPanel alignmentPanel">
              <AlignmentRow label="Settlement network" value={stacksSummary.network} strong />
              <AlignmentRow label="Unlock primitive" value={stacksSummary.unlock} />
              <AlignmentRow label="Settlement asset" value={stacksSummary.asset} />
              <AlignmentRow label="Clarity contract" value={stacksSummary.contract} />
            </div>

            <div className="miniPanel">
              <p className="panelKicker">Why this matters to judges</p>
              <ul className="list compact">
                <li>Shows explicit Clarity invoice-state modeling, not vague “blockchain integration”.</li>
                <li>Keeps x402 as the capability release layer and Stacks as the settlement semantics layer.</li>
                <li>Leaves room for sBTC / USDCx expansion without changing the user-facing flow.</li>
                <li>Makes technical depth legible to both Stacks experts and general product judges.</li>
              </ul>
            </div>

            <div className="miniPanel">
              <p className="panelKicker">Next unlocks for V8+</p>
              <ul className="list compact">
                <li>Wallet-connected real testnet payment verification</li>
                <li>Deployed Clarity contract with live state reads</li>
                <li>Exportable audit / protocol briefing modes</li>
              </ul>
            </div>
          </div>
        </aside>

        <section className="panel reportCard" aria-labelledby="report-heading">
          <div className="sectionHeader sectionHeader-start">
            <div>
              <p className="panelKicker">Output view</p>
              <h2 id="report-heading">Research dossier</h2>
            </div>
            <StatusPill status={job?.status} />
          </div>

          {!job ? (
            <div className="emptyState panelInset">
              <div className="emptyOrb" aria-hidden="true" />
              <h3>No active dossier</h3>
              <p>
                Submit a topic on the left. Once the research job is created, this panel becomes the active dossier view.
              </p>
            </div>
          ) : (
            <div className="stack-lg">
              <div className="jobMetaGrid">
                <div className="miniPanel">
                  <p className="panelKicker">Job id</p>
                  <p className="monoText">{job.id || 'pending'}</p>
                </div>
                <div className="miniPanel">
                  <p className="panelKicker">Research mode</p>
                  <p>{job.researchMode || 'analysis'}</p>
                </div>
                <div className="miniPanel">
                  <p className="panelKicker">Topic evidence</p>
                  <p>{job.papers?.length || 0}</p>
                </div>
              </div>

              <div className="miniPanel topicBanner">
                <p className="panelKicker">Topic</p>
                <p>{job.topic}</p>
              </div>

              {job.status === 'awaiting-payment' ? (
                <div className="unlockCard panelInset">
                  <div className="unlockHeader">
                    <div>
                      <p className="panelKicker">Payment required</p>
                      <h3>Unlock the premium dossier</h3>
                    </div>
                    <span className="tokenPill">x402 gate</span>
                  </div>
                  <p>{job.paymentRequest?.reason || 'Payment is required before the report can be revealed.'}</p>
                  <button className="primaryButton" onClick={payAndComplete} disabled={loading}>
                    {loading ? 'Processing payment…' : 'Unlock report'}
                  </button>
                </div>
              ) : null}

              {hasReport ? (
                <article className="reportBody panelInset stack-lg">
                  <div className="reportLead">
                    <div>
                      <p className="panelKicker">Unlocked markdown</p>
                      <p className="reportTopic">{job.topic}</p>
                    </div>
                    <div className="reportHint">Readable final summary with references only</div>
                  </div>

                  {reportMarkdown ? (
                    <div className="markdownReport">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {reportMarkdown}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="muted">The report content is not available yet.</p>
                  )}
                </article>
              ) : (
                <div className="emptyState panelInset emptyStateCompact">
                  <h3>Report not revealed yet</h3>
                  <p>
                    The job exists, but the dossier content is still waiting for the next workflow step.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
