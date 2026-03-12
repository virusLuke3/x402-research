import { useEffect, useState } from 'react';

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

function SectionCard({ title, children }) {
  return (
    <div className="reportSection">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export default function App() {
  const [topic, setTopic] = useState('Produce a research-grade report on the latest ZK rollup papers, with architecture-level analysis, evaluation tradeoffs, and diagram-oriented system understanding.');
  const [job, setJob] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function refreshJobs() {
    const data = await request('/api/jobs');
    setJobs(data.jobs || []);
  }

  async function loadConfig() {
    const data = await request('/api/config');
    setConfig(data);
  }

  useEffect(() => {
    loadConfig().catch(() => {});
    refreshJobs().catch(() => {});
  }, []);

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
      await refreshJobs();
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
      await refreshJobs();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <span className="badge">AutoScholar V2 · Research Dossier Mode</span>
        <h1>The x402-Powered Agentic Research Network</h1>
        <p>
          This iteration upgrades the demo from a simple summary flow to a multi-agent research dossier:
          manager orchestration, paid specialist unlock, structured evidence review, and academic-style synthesis.
        </p>
      </header>

      <main className="grid">
        <section className="card">
          <h2>Submit research request</h2>
          <form onSubmit={createJob} className="stack">
            <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={7} />
            <button disabled={loading}>{loading ? 'Working…' : 'Create manager job'}</button>
          </form>
          {error ? <p className="error">{error}</p> : null}
        </section>

        <section className="card">
          <h2>Runtime config</h2>
          {!config ? <p>Loading config…</p> : (
            <ul className="list compact">
              <li>API base: {config.apiBase}</li>
              <li>Paper source: {config.paperSource}</li>
              <li>LLM model: {config.model}</li>
              <li>LLM configured: {String(config.llmConfigured)}</li>
              <li>Provider: {config.providerBaseUrl}</li>
              <li>Payment asset: {config.paymentAsset}</li>
              <li>Payment amount: {config.paymentAmount}</li>
              <li>Orchestration: {config.orchestrationMode}</li>
            </ul>
          )}
        </section>

        <section className="card wide">
          <h2>Active job</h2>
          {!job ? <p>No job created yet.</p> : (
            <div className="stack">
              <div className="jobHeader">
                <strong>{job.id}</strong>
                <span className={`status status-${job.status}`}>{job.status}</span>
              </div>

              <div className="metaGrid">
                <div>
                  <p><strong>Topic</strong></p>
                  <p>{job.topic}</p>
                </div>
                <div>
                  <p><strong>Search query</strong></p>
                  <p>{job.searchQuery}</p>
                </div>
                <div>
                  <p><strong>Manager</strong></p>
                  <p>{job.orchestration?.manager}</p>
                </div>
                <div>
                  <p><strong>Meeting status</strong></p>
                  <p>{job.orchestration?.meetingStatus}</p>
                </div>
              </div>

              {job.llm?.error ? (
                <p className="error">
                  LLM fallback engaged: {job.llm.error}
                </p>
              ) : null}

              {job.orchestration?.specialists?.length ? (
                <SectionCard title="Agent committee">
                  <div className="pillRow">
                    {job.orchestration.specialists.map((agent) => (
                      <span key={agent} className="pill">{agent}</span>
                    ))}
                  </div>
                </SectionCard>
              ) : null}

              {job.papers?.length ? (
                <SectionCard title="Retrieved paper shortlist">
                  <ul className="list compact">
                    {job.papers.map((paper) => (
                      <li key={paper.id}>
                        <strong>{paper.title}</strong>
                        <div>{paper.authors?.join(', ') || 'Unknown authors'}</div>
                        <div>{paper.published} · relevance score {paper.relevanceScore}</div>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              ) : null}

              {job.status === 'awaiting-payment' ? (
                <div className="paymentBox">
                  <h3>x402 payment challenge</h3>
                  <p>{job.paymentRequest.reason}</p>
                  <ul className="list compact">
                    <li>Asset: {job.paymentRequest.asset}</li>
                    <li>Amount: {job.paymentRequest.amount}</li>
                    <li>Recipient: {job.paymentRequest.recipient}</li>
                    <li>Specialist: {job.paymentRequest.specialist}</li>
                  </ul>
                  <button onClick={payAndComplete} disabled={loading}>
                    {loading ? 'Processing payment…' : 'Simulate chain payment and run committee meeting'}
                  </button>
                </div>
              ) : null}

              {job.report ? (
                <div className="report stack">
                  <h3>{job.report.title}</h3>

                  <SectionCard title="Executive summary">
                    <p>{job.report.executiveSummary}</p>
                  </SectionCard>

                  <div className="columns">
                    <SectionCard title="Research question">
                      <p>{job.report.researchQuestion}</p>
                    </SectionCard>
                    <SectionCard title="Methodology">
                      <p>{job.report.methodology}</p>
                    </SectionCard>
                  </div>

                  <div className="columns">
                    <SectionCard title="Key findings">
                      <ul className="list compact">
                        {(job.report.keyFindings || []).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                      </ul>
                    </SectionCard>
                    <SectionCard title="Implications">
                      <ul className="list compact">
                        {(job.report.implications || []).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                      </ul>
                    </SectionCard>
                  </div>

                  <div className="columns">
                    <SectionCard title="Limitations">
                      <ul className="list compact">
                        {(job.report.limitations || []).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                      </ul>
                    </SectionCard>
                    <SectionCard title="Novelty assessment">
                      <p>{job.report.noveltyAssessment}</p>
                      <p className="muted"><strong>Consensus:</strong> {job.report.consensus}</p>
                    </SectionCard>
                  </div>

                  <SectionCard title="Multi-agent meeting notes">
                    <div className="debateList">
                      {(job.report.agentDebate || []).map((entry, index) => (
                        <div key={`${entry.agent}-${index}`} className="debateCard">
                          <strong>{entry.agent}</strong>
                          <div className="muted">{entry.role}</div>
                          <p>{entry.stance}</p>
                        </div>
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard title="Evidence table">
                    <div className="evidenceTable">
                      {(job.report.evidenceTable || []).map((item, index) => (
                        <div key={`${item.title}-${index}`} className="evidenceRow">
                          <strong>{item.title}</strong>
                          <p><span className="muted">Why it matters:</span> {item.whyItMatters}</p>
                          <p><span className="muted">Evidence:</span> {item.evidence}</p>
                        </div>
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard title="Extracted assets">
                    <ul className="list compact">
                      {(job.report.extractedAssets || []).map((asset) => (
                        <li key={asset.id}>{asset.title} — {asset.description}</li>
                      ))}
                    </ul>
                  </SectionCard>

                  <SectionCard title="Citations">
                    <ul className="list compact">
                      {(job.report.citations || []).map((item) => (
                        <li key={item.id}>
                          <strong>{item.ref}</strong> {item.title} — {item.authors?.join(', ') || 'Unknown authors'} ({item.published})
                        </li>
                      ))}
                    </ul>
                  </SectionCard>

                  <SectionCard title="Next research actions">
                    <ul className="list compact">
                      {(job.report.nextResearchActions || []).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                    </ul>
                  </SectionCard>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section className="card wide">
          <h2>Job history</h2>
          {jobs.length === 0 ? <p>No jobs yet.</p> : (
            <ul className="list compact">
              {jobs.map((item) => (
                <li key={item.id}>
                  <strong>{item.id}</strong> — {item.topic} — <em>{item.status}</em>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
