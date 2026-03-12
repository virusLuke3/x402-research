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
  const [topic, setTopic] = useState('预测未来3年AI agent economies会如何发展：包括支付基础设施、自治工具市场、以及machine-to-machine commerce的演化路径。');
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
        <span className="badge">AutoScholar V7.1 · Clarity-Oriented Stacks Payment Model</span>
        <h1>Topic-Agnostic Research Agent, x402/Stacks-Native Premium Unlock</h1>
        <p>
          In V7.1, the research topic stays arbitrary, while the payment layer is fixed to a testnet Stacks model:
          user wallet pays the project treasury address, x402 carries the challenge, and the settlement model is
          structured for eventual Clarity-smart-contract verification.
        </p>
      </header>

      <main className="grid">
        <section className="card">
          <h2>Submit research topic</h2>
          <form onSubmit={createJob} className="stack">
            <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={7} />
            <button disabled={loading}>{loading ? 'Working…' : 'Create research job'}</button>
          </form>
          {error ? <p className="error">{error}</p> : null}
        </section>

        <section className="card">
          <h2>System config</h2>
          {!config ? <p>Loading config…</p> : (
            <ul className="list compact">
              <li>API base: {config.apiBase}</li>
              <li>LLM model: {config.model}</li>
              <li>Provider: {config.providerBaseUrl}</li>
              <li>Evidence source: {config.paperSource}</li>
              <li>Orchestration: {config.orchestrationMode}</li>
              <li>Payment standard: {config.paymentRail?.challengeStandard}</li>
              <li>Settlement layer: {config.paymentRail?.settlementLayer}</li>
              <li>Stacks network: {config.stacksIntegration?.network}</li>
              <li>Stacks API: {config.stacksIntegration?.apiBase}</li>
              <li>Verification mode: {config.stacksIntegration?.verification}</li>
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
                  <p><strong>Research mode</strong></p>
                  <p>{job.researchMode}</p>
                </div>
                <div>
                  <p><strong>Search query</strong></p>
                  <p>{job.searchQuery}</p>
                </div>
                <div>
                  <p><strong>Meeting status</strong></p>
                  <p>{job.orchestration?.meetingStatus}</p>
                </div>
              </div>

              <SectionCard title="Layer separation">
                <ul className="list compact">
                  <li><strong>Research layer:</strong> retrieve papers, debate, and synthesize the user’s topic.</li>
                  <li><strong>Payment layer:</strong> x402 challenge + Stacks settlement flow unlocks premium report generation.</li>
                </ul>
              </SectionCard>

              {job.orchestration?.identities?.length ? (
                <SectionCard title="Agent identities">
                  <div className="debateList">
                    {job.orchestration.identities.map((entry, index) => (
                      <div key={`${entry.agent}-${index}`} className="debateCard">
                        <strong>{entry.agent}</strong>
                        <div className="muted">{entry.role}</div>
                        <p>{entry.persona}</p>
                        <p><span className="muted">Authority:</span> {entry.authority}</p>
                        <p><span className="muted">Payment capability:</span> {entry.paymentCapability}</p>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              ) : null}

              {job.papers?.length ? (
                <SectionCard title="Topic evidence">
                  <ul className="list compact">
                    {job.papers.map((paper) => (
                      <li key={paper.id}>
                        <strong>{paper.title}</strong>
                        <div>{paper.sourceType} · {paper.evidenceClass} · relevance {paper.relevanceScore}</div>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              ) : null}

              {job.paymentEvidence?.length ? (
                <SectionCard title="x402 / Stacks payment-rail evidence">
                  <ul className="list compact">
                    {job.paymentEvidence.map((paper) => (
                      <li key={paper.id}>
                        <strong>{paper.title}</strong>
                        <div>{paper.sourceType} · {paper.evidenceClass}</div>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              ) : null}

              {job.status === 'awaiting-payment' ? (
                <div className="paymentBox">
                  <h3>x402 premium unlock</h3>
                  <p>{job.paymentRequest.reason}</p>
                  <ul className="list compact">
                    <li>Asset: {job.paymentRequest.asset}</li>
                    <li>Asset type: {job.paymentRequest.assetType}</li>
                    <li>Amount: {job.paymentRequest.amount}</li>
                    <li>Payer: {job.paymentRequest.payer}</li>
                    <li>Recipient: {job.paymentRequest.recipient}</li>
                    <li>Challenge: {job.paymentRequest.challenge}</li>
                    <li>Stacks network: {job.paymentRequest.stacks?.network}</li>
                    <li>Stacks API: {job.paymentRequest.stacks?.apiBase}</li>
                    <li>Settlement method: {job.paymentRequest.stacks?.settlementMethod}</li>
                    <li>Memo: {job.paymentRequest.stacks?.memo}</li>
                  </ul>
                  <button onClick={payAndComplete} disabled={loading}>
                    {loading ? 'Processing payment…' : 'Pay via x402 + Stacks flow and unlock report'}
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

                  <SectionCard title="Payment rail (fixed infrastructure layer)">
                    <ul className="list compact">
                      <li>Challenge standard: {job.report.paymentRail?.challengeStandard}</li>
                      <li>Settlement layer: {job.report.paymentRail?.settlementLayer}</li>
                      <li>Settlement assets: {(job.report.paymentRail?.settlementAssets || []).join(', ')}</li>
                      <li>Authorization model: {job.report.paymentRail?.authorizationModel}</li>
                      <li>Unlock rule: {job.report.paymentRail?.queryUnlock}</li>
                      <li>Stacks network: {job.report.paymentRail?.stacks?.network}</li>
                      <li>Stacks API: {job.report.paymentRail?.stacks?.apiBase}</li>
                      <li>Verification mode: {job.report.paymentRail?.stacks?.verificationMode}</li>
                      <li>Contract language: Clarity</li>
                    </ul>
                  </SectionCard>

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

                  {(job.report.scenarios || []).length ? (
                    <SectionCard title="Forecast scenarios">
                      <div className="debateList">
                        {job.report.scenarios.map((item, index) => (
                          <div key={`${item.name}-${index}`} className="debateCard">
                            <strong>{item.name}</strong>
                            <div className="muted">Probability: {item.probability}</div>
                            <p>{item.outlook}</p>
                            <p><span className="muted">Driver:</span> {item.driver}</p>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  ) : null}

                  {(job.report.timeline || []).length ? (
                    <SectionCard title="Timeline outlook">
                      <ul className="list compact">
                        {job.report.timeline.map((item, index) => (
                          <li key={`${item.window}-${index}`}><strong>{item.window}</strong> — {item.expectation}</li>
                        ))}
                      </ul>
                    </SectionCard>
                  ) : null}

                  <div className="columns">
                    <SectionCard title="Research quality">
                      <ul className="list compact">
                        <li>Evidence coverage: {job.report.quality?.evidenceCoverage}</li>
                        <li>Synthesis mode: {job.report.quality?.synthesisMode}</li>
                        <li>Confidence: {job.report.quality?.confidence}</li>
                        <li>Forecast framework: {job.report.quality?.evidenceStats?.['forecast-framework'] ?? 0}</li>
                        <li>Supporting: {job.report.quality?.evidenceStats?.supporting ?? 0}</li>
                        <li>Off-topic: {job.report.quality?.evidenceStats?.['off-topic'] ?? 0}</li>
                      </ul>
                    </SectionCard>
                    <SectionCard title="LLM runtime">
                      <ul className="list compact">
                        <li>Mode: {job.llm?.mode}</li>
                        <li>Model: {job.llm?.model}</li>
                        <li>Provider: {job.llm?.providerBaseUrl}</li>
                      </ul>
                    </SectionCard>
                  </div>

                  <SectionCard title="AI Parliament meeting notes">
                    <div className="debateList">
                      {(job.report.parliament || []).map((entry, index) => (
                        <div key={`${entry.agent}-${index}`} className="debateCard">
                          <strong>{entry.agent}</strong>
                          <div className="muted">{entry.role}</div>
                          <p>{entry.stance}</p>
                        </div>
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard title="Topic evidence table">
                    <div className="evidenceTable">
                      {(job.report.evidenceTable || []).map((item, index) => (
                        <div key={`${item.title}-${index}`} className="evidenceRow">
                          <strong>{item.title}</strong>
                          <p><span className="muted">Evidence class:</span> {item.evidenceClass}</p>
                          <p><span className="muted">Source type:</span> {item.sourceType}</p>
                          <p><span className="muted">Why it matters:</span> {item.whyItMatters}</p>
                          <p><span className="muted">Evidence:</span> {item.evidence}</p>
                        </div>
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard title="Payment-rail evidence table">
                    <div className="evidenceTable">
                      {(job.report.paymentEvidenceTable || []).map((item, index) => (
                        <div key={`${item.title}-${index}`} className="evidenceRow">
                          <strong>{item.title}</strong>
                          <p><span className="muted">Evidence class:</span> {item.evidenceClass}</p>
                          <p><span className="muted">Source type:</span> {item.sourceType}</p>
                          <p><span className="muted">Why it matters:</span> {item.whyItMatters}</p>
                          <p><span className="muted">Evidence:</span> {item.evidence}</p>
                        </div>
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard title="x402 / Stacks payment flow">
                    <ul className="list compact">
                      {(job.report.paymentFlow || []).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                    </ul>
                    <p className="muted">
                      Model: user wallet pays the platform treasury on Stacks testnet; later versions can swap the transfer path
                      into a Clarity smart contract call without changing the research workflow.
                    </p>
                  </SectionCard>

                  <SectionCard title="Extracted assets">
                    <ul className="list compact">
                      {(job.report.extractedAssets || []).map((asset) => (
                        <li key={asset.id}>{asset.title} — {asset.description}</li>
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
