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

  return (
    <div className="page">
      <div className="pageGlow pageGlowA" aria-hidden="true" />
      <div className="pageGlow pageGlowB" aria-hidden="true" />

      <header className="topbar panelLite" aria-label="Application header">
        <div className="brandLockup">
          <span className="brandMark" aria-hidden="true">◈</span>
          <div>
            <p className="brandName">AutoScholar</p>
            <p className="brandSub">x402 research console</p>
          </div>
        </div>
        <div className="topbarMeta">
          <span className="badge">Protocol dossier UI</span>
          <StatusPill status={job?.status} />
        </div>
      </header>

      <section className="heroSplit panel">
        <div className="heroMain stack-lg">
          <div className="heroHead stack-sm">
            <span className="eyebrow">Premium research workflow</span>
            <h1>Research pages should feel like dossiers, not chat windows.</h1>
            <p className="heroText">
              This interface keeps the topic composer, payment gate, and final markdown report in one clear flow.
              It’s designed to feel deliberate, editorial, and protocol-native rather than generic “AI app” chrome.
            </p>
          </div>

          <div className="statsGrid" aria-label="Current summary stats">
            <StatTile label="Research mode" value={summaryStats.mode} tone="accent" />
            <StatTile label="Topic evidence" value={String(summaryStats.papers)} />
            <StatTile label="Payment evidence" value={String(summaryStats.paymentEvidence)} />
            <StatTile label="Workflow" value={String(summaryStats.status).replaceAll('_', ' ')} tone="warn" />
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

      <main className="workspaceGrid">
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
              <p className="helperText">API base: {API_BASE}</p>
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
