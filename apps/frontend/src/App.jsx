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

export default function App() {
  const [topic, setTopic] = useState('Summarize the latest 2025 papers on ZK Rollups and include core architecture diagrams.');
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
        <span className="badge">AutoScholar MVP</span>
        <h1>The x402-Powered Agentic Research Network</h1>
        <p>
          This version uses arXiv for paper discovery, an OpenAI-compatible provider for summary generation,
          and a simulated Stacks payment flow for the paid specialist molbot.
        </p>
      </header>

      <main className="grid">
        <section className="card">
          <h2>Submit research request</h2>
          <form onSubmit={createJob} className="stack">
            <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={6} />
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
              <p><strong>Topic:</strong> {job.topic}</p>
              <p><strong>Search query:</strong> {job.searchQuery}</p>
              {job.llm?.error ? (
                <p className="error">
                  LLM fallback engaged: {job.llm.error}
                </p>
              ) : null}

              {job.papers?.length ? (
                <div className="report">
                  <h3>arXiv paper shortlist</h3>
                  <ul className="list compact">
                    {job.papers.map((paper) => (
                      <li key={paper.id}>
                        <strong>{paper.title}</strong>
                        <div>{paper.authors?.join(', ') || 'Unknown authors'}</div>
                        <div>{paper.published}</div>
                      </li>
                    ))}
                  </ul>
                </div>
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
                    {loading ? 'Processing payment…' : 'Simulate chain payment and continue'}
                  </button>
                </div>
              ) : null}

              {job.report ? (
                <div className="report">
                  <h3>{job.report.title}</h3>
                  <p>{job.report.summary}</p>
                  <div className="columns">
                    <div>
                      <h4>Key findings</h4>
                      <ul className="list compact">
                        {(job.report.keyFindings || []).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h4>Implications</h4>
                      <ul className="list compact">
                        {(job.report.implications || []).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                      </ul>
                    </div>
                  </div>
                  <h4>Extracted assets</h4>
                  <ul className="list compact">
                    {(job.report.extractedAssets || []).map((asset) => (
                      <li key={asset.id}>{asset.title} — {asset.description}</li>
                    ))}
                  </ul>
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
