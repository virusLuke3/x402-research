import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';
const DEMO_PAYMENT_TOKEN = 'demo-paid-token';

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
  if (!status) return null;
  return <span className={`status status-${status}`}>{String(status).replaceAll('_', ' ')}</span>;
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
        title: 'Topic drafted',
        description: 'Research scope is defined and ready for submission.',
        active: topicLength > 0,
        complete: Boolean(job)
      },
      {
        key: 'awaiting-payment',
        title: 'Payment gate',
        description: 'The report is prepared behind the x402 payment checkpoint.',
        active: currentStatus === 'awaiting-payment',
        complete: currentStatus === 'completed' || currentStatus === 'completed_with_fallback'
      },
      {
        key: 'completed',
        title: 'Dossier unlocked',
        description: 'Final markdown report and references are available for reading.',
        active: currentStatus === 'completed' || currentStatus === 'completed_with_fallback',
        complete: currentStatus === 'completed' || currentStatus === 'completed_with_fallback'
      }
    ];
  }, [job, topicLength]);

  return (
    <div className="page">
      <div className="pageGlow pageGlowA" aria-hidden="true" />
      <div className="pageGlow pageGlowB" aria-hidden="true" />

      <header className="hero panel panelHero">
        <div className="heroTopline">
          <span className="eyebrow">x402 research console</span>
          <span className="badge">Protocol dossier</span>
        </div>

        <div className="heroGrid">
          <div className="heroCopy stack-lg">
            <div className="stack-sm">
              <h1>Unlock a research dossier, not a generic AI answer.</h1>
              <p className="heroText">
                Submit a topic, pass the payment gate, and read a clean final report with references only.
                Internal chain-of-thought, noisy agent chatter, and system diagnostics stay off the page.
              </p>
            </div>

            <div className="heroMeta" aria-label="Product highlights">
              <div className="metaChip">
                <span className="metaLabel">Flow</span>
                <strong>Topic → Pay → Read</strong>
              </div>
              <div className="metaChip">
                <span className="metaLabel">Output</span>
                <strong>Markdown dossier</strong>
              </div>
              <div className="metaChip">
                <span className="metaLabel">Guardrail</span>
                <strong>Reasoning hidden</strong>
              </div>
            </div>
          </div>

          <aside className="heroAside panel panelInset" aria-label="Research workflow overview">
            <div className="asideHeader">
              <p className="panelKicker">Workflow state</p>
              <StatusPill status={job?.status || 'idle'} />
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
                    <h2>{item.title}</h2>
                    <p>{item.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </header>

      <main className="workspaceGrid">
        <section className="panel composerCard" aria-labelledby="compose-heading">
          <div className="sectionHeader sectionHeader-start">
            <div>
              <p className="panelKicker">Compose query</p>
              <h2 id="compose-heading">Describe the topic you want investigated</h2>
            </div>
            <div className="counterChip" aria-label="Topic length">
              {topicLength} chars
            </div>
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
              placeholder="Ask for recent Solidity漏洞研究、x402 payment design tradeoffs、Stacks settlement architecture…"
            />

            <div className="actionRow">
              <button className="primaryButton" disabled={loading}>
                {loading ? 'Working…' : 'Create research job'}
              </button>
              <p className="helperText">Current API: {API_BASE}</p>
            </div>
          </form>

          {error ? <p className="error" role="alert">{error}</p> : null}

          <div className="subgrid">
            <article className="miniPanel">
              <p className="panelKicker">What stays visible</p>
              <ul className="list compact">
                <li>Topic metadata</li>
                <li>Payment checkpoint</li>
                <li>Final markdown report</li>
                <li>Reference links</li>
              </ul>
            </article>
            <article className="miniPanel">
              <p className="panelKicker">What stays hidden</p>
              <ul className="list compact">
                <li>Intermediate agent reasoning</li>
                <li>Prompt internals</li>
                <li>System diagnostics</li>
                <li>Tool chatter</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="panel reportCard" aria-labelledby="report-heading">
          <div className="sectionHeader">
            <div>
              <p className="panelKicker">Unlocked output</p>
              <h2 id="report-heading">Research dossier</h2>
            </div>
            {job ? <StatusPill status={job.status} /> : <span className="status status-idle">idle</span>}
          </div>

          {!job ? (
            <div className="emptyState panelInset">
              <div className="emptyOrb" aria-hidden="true" />
              <h3>No dossier yet</h3>
              <p>
                Start by submitting a topic. Once the job is created, this panel becomes the live dossier view.
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
                  <p className="panelKicker">Status</p>
                  <p>{job.status}</p>
                </div>
                <div className="miniPanel miniPanel-topic">
                  <p className="panelKicker">Topic</p>
                  <p>{job.topic}</p>
                </div>
              </div>

              {job.status === 'awaiting-payment' ? (
                <div className="unlockCard panelInset">
                  <div className="unlockHeader">
                    <div>
                      <p className="panelKicker">Payment required</p>
                      <h3>Unlock the final report</h3>
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
                  <div className="reportHeader">
                    <div>
                      <p className="panelKicker">Final output</p>
                      <p className="reportTopic">{job.topic}</p>
                    </div>
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
                    The job exists, but the dossier content is still waiting on the next workflow step.
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
