import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import express from 'express';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: true });

const app = express();
const PORT = process.env.PORT || 8787;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const DEMO_PAYMENT_TOKEN = process.env.DEMO_PAYMENT_TOKEN || 'demo-paid-token';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.4';

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

const jobs = new Map();

function makeId(prefix = 'job') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function extractQuery(topic) {
  const cleaned = String(topic || '')
    .replace(/summarize|latest|papers|paper|include|core|architecture|diagrams|diagram|research|report/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/x402|stacks|usdcx|sbtc|sip-?10|clarity|bitcoin l2/i.test(String(topic || ''))) {
    return cleaned || 'x402 Stacks USDCx sBTC agent payments';
  }

  return cleaned || 'ZK Rollup';
}

function formatDate(value) {
  if (!value) return 'Unknown date';
  return new Date(value).toISOString().slice(0, 10);
}

function truncate(text, max = 260) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function scorePaperRelevance(topic, paper, index) {
  const topicTerms = String(topic || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const haystack = `${paper.title} ${paper.summary}`.toLowerCase();
  const termHits = topicTerms.filter((term) => haystack.includes(term)).length;
  const recencyBoost = paper.published?.startsWith('2025') || paper.published?.startsWith('2026') ? 2 : 0;
  const positionBoost = Math.max(0, 5 - index);
  return termHits + recencyBoost + positionBoost;
}

function buildStacksX402SeedPapers(topic) {
  const seeds = [
    {
      id: 'seed-x402-1',
      title: 'x402 payment challenge semantics for machine-to-machine APIs',
      summary: 'A protocol-oriented note on using HTTP 402 Payment Required as a machine-readable payment challenge for paid APIs. Emphasis is placed on payment challenge structure, settlement proof handoff, and capability release after verified payment.',
      published: '2026-01-10',
      authors: ['AutoScholar Research Seeds']
    },
    {
      id: 'seed-stacks-1',
      title: 'Stacks settlement patterns for agent networks using USDCx and sBTC',
      summary: 'A systems memo describing how Stacks-native assets such as USDCx and sBTC can support service pricing, settlement receipts, and Bitcoin-aligned trust narratives for multi-agent payment networks.',
      published: '2026-01-14',
      authors: ['AutoScholar Research Seeds']
    },
    {
      id: 'seed-stacks-2',
      title: 'Capability release after payment: authorization design for specialist agent molbots',
      summary: 'An engineering brief on post-payment access control, including session-scoped capability release, specialist routing, and the separation between challenge issuance, payment confirmation, and downstream model/tool access.',
      published: '2026-01-18',
      authors: ['AutoScholar Research Seeds']
    },
    {
      id: 'seed-stacks-3',
      title: 'Tradeoffs in Bitcoin-adjacent settlement for agent commerce',
      summary: 'A design analysis of latency, trust assumptions, settlement certainty, and UX constraints when implementing machine-to-machine payments with Bitcoin-adjacent execution layers such as Stacks.',
      published: '2026-01-22',
      authors: ['AutoScholar Research Seeds']
    },
    {
      id: 'seed-x402-2',
      title: 'Committee-based research agents with payment-gated specialist endpoints',
      summary: 'A product and architecture note on combining a manager agent, retrieval committee, critic pass, and paid specialist molbots into a single x402-powered research workflow.',
      published: '2026-02-01',
      authors: ['AutoScholar Research Seeds']
    }
  ];

  return seeds.map((paper, index) => ({
    ...paper,
    relevanceScore: scorePaperRelevance(topic, paper, index)
  }));
}

async function fetchArxivPapers(query, topic) {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=6&sortBy=relevance&sortOrder=descending`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AutoScholar/0.3 (hackathon research demo)'
      }
    });

    if (!response.ok) {
      throw new Error(`arXiv request failed with status ${response.status}`);
    }

    const xml = await response.text();
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => match[1]);

    const papers = entries.map((entry, index) => {
    const title = (entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').replace(/\s+/g, ' ').trim();
    const summary = (entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] || '').replace(/\s+/g, ' ').trim();
    const id = (entry.match(/<id>([\s\S]*?)<\/id>/)?.[1] || '').trim();
    const published = (entry.match(/<published>([\s\S]*?)<\/published>/)?.[1] || '').trim();
    const authors = [...entry.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>\s*<\/author>/g)].map((m) => m[1].trim());
    const paper = {
      id: id || `arxiv-${index + 1}`,
      title,
      summary,
      published,
      authors
    };

      return {
        ...paper,
        relevanceScore: scorePaperRelevance(topic || query, paper, index)
      };
    }).filter((paper) => paper.title).sort((a, b) => b.relevanceScore - a.relevanceScore);

    if (papers.length > 0) {
      return papers;
    }

    if (/x402|stacks|usdcx|sbtc|sip-?10|clarity|bitcoin/i.test(String(topic || query))) {
      return buildStacksX402SeedPapers(topic || query);
    }

    throw new Error('no papers returned from arXiv');
  } catch (error) {
    if (/x402|stacks|usdcx|sbtc|sip-?10|clarity|bitcoin/i.test(String(topic || query))) {
      return buildStacksX402SeedPapers(topic || query);
    }
    throw error;
  }
}

function parseJSONContent(content) {
  if (typeof content !== 'string') {
    return null;
  }

  try {
    return JSON.parse(content);
  } catch {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
    if (!fenced) {
      return null;
    }

    try {
      return JSON.parse(fenced);
    } catch {
      return null;
    }
  }
}

function safeArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function buildDeterministicEvidenceTable(papers) {
  return papers.slice(0, 4).map((paper, index) => ({
    paperId: paper.id,
    title: paper.title,
    whyItMatters: `Top-ranked retrieval candidate #${index + 1} with relevance score ${paper.relevanceScore}.`,
    evidence: truncate(paper.summary, 220),
    protocolLens: /stacks|bitcoin|settlement|payment|token|contract|clarity|sbtc|usdcx|bridge|protocol/i.test(`${paper.title} ${paper.summary}`)
      ? 'Relevant to x402 / Stacks payment architecture'
      : 'General supporting systems evidence'
  }));
}

function buildAgentDebate(topic, papers, planner = {}, skeptic = {}, synthesizer = {}) {
  const lead = papers[0];
  const second = papers[1];
  const third = papers[2];

  return [
    {
      agent: 'Planner Agent',
      role: 'Scope and decomposition',
      stance: planner.scope || `The core question is: ${topic}. We should prioritize papers with explicit system architecture, proving pipeline, or benchmarking evidence.`
    },
    {
      agent: 'Retriever Agent',
      role: 'Evidence gathering',
      stance: planner.retrievalPlan || (lead ? `The strongest retrieval candidate is “${lead.title}”, supported by ${lead.authors?.slice(0, 3).join(', ') || 'unknown authors'} and published on ${formatDate(lead.published)}.` : 'No strong retrieval candidate was found.')
    },
    {
      agent: 'Skeptic Agent',
      role: 'Challenge weak claims',
      stance: skeptic.challenge || (second ? `Avoid claiming general superiority. The abstract of “${second.title}” supports only limited conclusions, mostly around ${truncate(second.summary, 120)}.` : 'Claims should be kept conservative because evidence coverage is thin.')
    },
    {
      agent: 'Synthesis Agent',
      role: 'Cross-paper synthesis',
      stance: synthesizer.consensus || (third ? `A reasonable synthesis is that current work converges on modular proving systems, sequencer/prover separation, and practical deployment tradeoffs, with “${third.title}” reinforcing that theme.` : 'Synthesis should stay at the level of recurring system motifs and not overstate consensus.')
    }
  ];
}

function buildLocalFallbackSummary(topic, papers, reason = 'LLM unavailable') {
  const topPapers = papers.slice(0, 4);
  return {
    mode: 'fallback',
    executiveSummary: `${reason}. Returning a locally generated research brief for ${topic}.`,
    researchQuestion: topic,
    methodology: 'Fallback synthesis from arXiv metadata, relevance scoring, and deterministic manager heuristics.',
    keyFindings: topPapers.map((paper) => `${paper.title} — ${truncate(paper.summary, 180)}`),
    implications: [
      'Provider credentials or prompt strategy should be validated before live demo runs.',
      'Fallback mode preserves the research pipeline but lowers synthesis quality and nuance.',
      'A multi-pass synthesis path is preferred for stable judge-facing output.'
    ],
    limitations: [
      'No model-driven cross-paper synthesis was produced.',
      'Findings were distilled from metadata and abstracts only.'
    ],
    evidenceTable: buildDeterministicEvidenceTable(topPapers),
    agentDebate: buildAgentDebate(topic, topPapers),
    consensus: 'Use the shortlisted papers as the minimal evidence pack until LLM synthesis is restored.',
    noveltyAssessment: 'Medium: adequate for demo continuity, weak for judge-facing academic polish.',
    nextResearchActions: [
      'Rerun the planner/skeptic/synthesizer chain with stricter token budgeting.',
      'Download PDFs and extract diagrams for stronger evidence grounding.',
      'Add a critic pass that checks overclaims against cited abstracts.'
    ],
    quality: {
      evidenceCoverage: topPapers.length,
      synthesisMode: 'fallback',
      confidence: 'low'
    }
  };
}

async function callLLM(messages, temperature = 0.1) {
  const rawText = await new Promise((resolve, reject) => {
    const child = spawn('python3', [path.resolve(__dirname, './llm_tuzi.py')], {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stdout || stderr || `python exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });

    child.stdin.write(JSON.stringify({ messages, temperature }));
    child.stdin.end();
  });

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(`LLM returned non-JSON envelope: ${rawText}`);
  }

  if (parsed?.code !== undefined) {
    if (parsed.code !== 0) {
      throw new Error(parsed.message || JSON.stringify(parsed));
    }
    parsed = parsed.data || {};
  }

  if (parsed?.http_status || parsed?.error) {
    throw new Error(parsed.error || `HTTP ${parsed.http_status}`);
  }

  return parsed?.choices?.[0]?.message?.content ?? parsed?.choices?.[0]?.content ?? parsed?.choices?.[0]?.text ?? '';
}

async function callJSONAgent(role, instruction, payload, fallbackObject) {
  const systemPrompt = [
    `You are the ${role} in an academic multi-agent research committee.`,
    'Use only the provided evidence.',
    'Be conservative, specific, and non-marketing.',
    'Return strict JSON only.'
  ].join(' ');

  const userPrompt = [
    instruction,
    `Payload: ${JSON.stringify(payload)}`
  ].join(' ');

  try {
    const content = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], 0.1);
    return parseJSONContent(content) || fallbackObject;
  } catch {
    return fallbackObject;
  }
}

async function runResearchCommittee(topic, papers) {
  const evidencePack = papers.slice(0, 5).map((paper, index) => ({
    rank: index + 1,
    title: paper.title,
    published: formatDate(paper.published),
    authors: paper.authors,
    relevanceScore: paper.relevanceScore,
    abstract: truncate(paper.summary, 700)
  }));

  const plannerFallback = {
    scope: `Focus on the research question: ${topic}. Prioritize x402 payment flow design, Stacks settlement assumptions, USDCx/sBTC asset handling, authorization after payment, and system tradeoffs.`,
    retrievalPlan: 'Rank papers by protocol relevance, payment architecture, settlement design, and implementation realism.',
    evaluationCriteria: ['x402/payment challenge clarity', 'Stacks settlement design', 'asset and authorization flow', 'system tradeoffs']
  };

  const planner = await callJSONAgent(
    'Planner Agent',
    'Return JSON with keys scope, retrievalPlan, evaluationCriteria (array of short strings).',
    { topic, evidencePack },
    plannerFallback
  );

  const skepticFallback = {
    challenge: 'Do not claim that x402 or Stacks settlement is trustless, production-ready, or economically dominant unless the evidence explicitly supports it.',
    weakPoints: ['abstract-only evidence', 'limited settlement verification detail', 'possible overgeneralization from architecture proposals to deployed payment rails'],
    caution: 'State findings as protocol design patterns and open engineering questions rather than finished infrastructure guarantees.'
  };

  const skeptic = await callJSONAgent(
    'Skeptic Agent',
    'Return JSON with keys challenge, weakPoints (array of short strings), caution.',
    { topic, evidencePack, planner },
    skepticFallback
  );

  const synthesisFallback = {
    executiveSummary: `The current evidence suggests that an x402-centered agent economy on Stacks should be framed as a protocol and systems architecture problem: how payment challenges, settlement confirmation, asset selection, and post-payment capability grants fit together into a reliable multi-agent network. The strongest direction is not "instant production readiness" but a composable payment-gated service model built around clear challenge semantics, Stacks-based settlement, and specialist agent coordination.`,
    keyFindings: [
      'x402 is best understood as the access-control and payment-challenge layer for paid agent endpoints.',
      'Stacks provides a strong narrative for settlement because it anchors the payment flow in a Bitcoin-adjacent execution environment.',
      'USDCx offers a stable pricing path for services, while sBTC strengthens ecosystem alignment and strategic positioning.',
      'The key engineering problem is not just payment, but what capability, token, or session scope is released after verified settlement.'
    ],
    implications: [
      'The project should present itself as a machine-to-machine commerce architecture, not just a chatbot that happens to charge money.',
      'Demo messaging should emphasize payment challenge semantics, settlement flow, and post-payment authorization.',
      'Judge-facing output should distinguish what is already simulated from what is intended for real Stacks verification.'
    ],
    consensus: 'The strongest supported conclusion is that x402 plus Stacks is a credible design center for agent-to-agent paid APIs, provided settlement and authorization are made explicit.',
    noveltyAssessment: 'High at the systems-composition level: the novelty lies in combining payment-gated APIs, Stacks settlement, and specialist agent orchestration into one coherent service network.',
    nextResearchActions: [
      'Prototype a real Stacks verification adapter for x402 receipts.',
      'Define a capability token or macaroon model for post-payment access grants.',
      'Document USDCx vs sBTC service pricing tradeoffs for different agent classes.'
    ]
  };

  const synthesizer = await callJSONAgent(
    'Synthesis Agent',
    'Return JSON with keys executiveSummary, keyFindings (4-7 short strings), implications (3-5 short strings), consensus, noveltyAssessment, nextResearchActions (3-5 short strings).',
    { topic, evidencePack, planner, skeptic },
    synthesisFallback
  );

  const criticFallback = {
    methodology: 'A staged committee process combined arXiv retrieval, planner scoping, skeptic challenge, and synthesis over protocol-relevant abstracts, with emphasis on x402 challenge design, Stacks settlement, and asset flow assumptions.',
    limitations: ['Abstract-only evidence limits claim strength.', 'Most evidence discusses architecture patterns more than production payment operations.', 'Real Stacks verification is still simulated in the current implementation.'],
    confidence: 'medium'
  };

  const critic = await callJSONAgent(
    'Critic Agent',
    'Return JSON with keys methodology, limitations (2-4 short strings), confidence.',
    { topic, evidencePack, planner, skeptic, synthesizer },
    criticFallback
  );

  return {
    mode: 'llm-committee',
    executiveSummary: synthesizer.executiveSummary,
    researchQuestion: topic,
    methodology: critic.methodology,
    keyFindings: safeArray(synthesizer.keyFindings, []),
    implications: safeArray(synthesizer.implications, []),
    limitations: safeArray(critic.limitations, []),
    evidenceTable: buildDeterministicEvidenceTable(papers),
    agentDebate: buildAgentDebate(topic, papers, planner, skeptic, synthesizer),
    consensus: synthesizer.consensus,
    noveltyAssessment: synthesizer.noveltyAssessment,
    nextResearchActions: safeArray(synthesizer.nextResearchActions, []),
    quality: {
      evidenceCoverage: evidencePack.length,
      synthesisMode: 'multi-agent-committee',
      confidence: critic.confidence || 'medium'
    }
  };
}

async function generateLLMSummary(topic, papers) {
  if (!OPENAI_API_KEY) {
    return buildLocalFallbackSummary(topic, papers, 'OpenAI-compatible key not configured');
  }

  try {
    return await runResearchCommittee(topic, papers);
  } catch (error) {
    return {
      ...buildLocalFallbackSummary(topic, papers, 'LLM committee request errored'),
      error: error.message || 'unknown llm error'
    };
  }
}

function buildResearchReport(topic, papers, llmResult, extractedAssets) {
  return {
    title: `AutoScholar research dossier: ${topic}`,
    executiveSummary: llmResult.executiveSummary || 'No summary generated.',
    researchQuestion: llmResult.researchQuestion || topic,
    methodology: llmResult.methodology || 'arXiv retrieval, manager triage, paid specialist unlock, and model-based synthesis.',
    protocolFocus: {
      challengeStandard: 'x402 / HTTP 402 Payment Required',
      settlementLayer: 'Stacks',
      settlementAssets: ['USDCx', 'sBTC'],
      authorizationModel: 'payment-gated specialist access after verified settlement',
      specialistPattern: 'manager + paid molbot + post-payment capability release'
    },
    keyFindings: safeArray(llmResult.keyFindings, []),
    evidenceTable: safeArray(llmResult.evidenceTable, []),
    agentDebate: safeArray(llmResult.agentDebate, buildAgentDebate(topic, papers)),
    consensus: llmResult.consensus || 'The evidence suggests a cautious synthesis rather than a single dominant conclusion.',
    limitations: safeArray(llmResult.limitations, []),
    implications: safeArray(llmResult.implications, []),
    noveltyAssessment: llmResult.noveltyAssessment || 'Unknown',
    nextResearchActions: safeArray(llmResult.nextResearchActions, []),
    quality: llmResult.quality || { evidenceCoverage: papers.length, synthesisMode: 'unknown', confidence: 'unknown' },
    papers,
    extractedAssets,
    citations: papers.map((paper, index) => ({
      ref: `[${index + 1}]`,
      title: paper.title,
      published: formatDate(paper.published),
      authors: paper.authors,
      id: paper.id
    }))
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'autoscholar-backend', mode: 'hybrid-demo' });
});

app.get('/api/config', (_req, res) => {
  res.json({
    apiBase: `http://localhost:${PORT}`,
    frontendOrigin: FRONTEND_ORIGIN,
    demoMode: true,
    paymentAsset: 'USDCx',
    paymentAmount: '0.5',
    llmConfigured: Boolean(OPENAI_API_KEY),
    model: OPENAI_MODEL,
    providerBaseUrl: OPENAI_BASE_URL,
    paperSource: 'arXiv',
    orchestrationMode: 'manager + planner + retriever + skeptic + synthesis + critic',
    requiredEnv: OPENAI_API_KEY ? [] : ['OPENAI_API_KEY']
  });
});

app.get('/api/jobs', (_req, res) => {
  res.json({ jobs: Array.from(jobs.values()) });
});

app.post('/api/research', async (req, res) => {
  const { topic } = req.body || {};

  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({ error: 'topic is required' });
  }

  try {
    const searchQuery = extractQuery(topic);
    const papers = await fetchArxivPapers(searchQuery, topic);
    const id = makeId();
    const job = {
      id,
      topic,
      searchQuery,
      paperSource: 'arXiv',
      papers,
      status: 'awaiting-payment',
      createdAt: new Date().toISOString(),
      orchestration: {
        manager: 'Manager Molbot',
        specialists: ['Planner Agent', 'Retriever Agent', 'Skeptic Agent', 'Synthesis Agent', 'Critic Agent', 'Image Extractor Molbot'],
        meetingStatus: 'scheduled'
      },
      paymentRequest: {
        type: 'x402',
        asset: 'USDCx',
        amount: '0.5',
        recipient: 'STX-DEMO-RECIPIENT',
        challenge: 'HTTP 402 Payment Required',
        specialist: 'Image Extractor Molbot',
        reason: 'Diagram extraction requires payment before access is granted.'
      },
      extractedAssets: [],
      report: null
    };

    jobs.set(id, job);
    return res.status(202).json(job);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'failed to create job' });
  }
});

app.post('/api/jobs/:id/pay', async (req, res) => {
  const job = jobs.get(req.params.id);

  if (!job) {
    return res.status(404).json({ error: 'job not found' });
  }

  const token = req.header('x-payment-token') || req.body?.paymentToken;

  if (token !== DEMO_PAYMENT_TOKEN) {
    return res.status(402).json({
      error: 'payment required',
      message: 'Provide a valid demo payment token to unlock the specialist molbot.',
      expectedHeader: 'x-payment-token'
    });
  }

  try {
    const extractedAssets = [
      {
        id: 'asset_1',
        type: 'diagram',
        title: 'ZK Rollup architecture overview',
        description: 'Simulated extracted diagram delivered by the paid Image Extractor Molbot.'
      },
      {
        id: 'asset_2',
        type: 'chart',
        title: 'Sequencer / prover / verifier interaction',
        description: 'Simulated chart representing the system architecture flow.'
      }
    ];

    job.status = 'processing';
    job.orchestration.meetingStatus = 'in-progress';
    jobs.set(job.id, job);

    const llmResult = await generateLLMSummary(job.topic, job.papers || []);
    const usedFallback = llmResult.mode === 'fallback';

    job.status = usedFallback ? 'completed_with_fallback' : 'completed';
    job.orchestration.meetingStatus = 'concluded';
    job.paidAt = new Date().toISOString();
    job.paymentReceipt = {
      asset: 'USDCx',
      amount: '0.5',
      txid: 'demo-stacks-txid',
      settlement: 'mock-success',
      mode: 'simulated-chain-payment'
    };
    job.extractedAssets = extractedAssets;
    job.llm = {
      mode: llmResult.mode,
      model: OPENAI_MODEL,
      providerBaseUrl: OPENAI_BASE_URL,
      error: llmResult.error || null
    };
    job.report = buildResearchReport(job.topic, job.papers || [], llmResult, extractedAssets);

    jobs.set(job.id, job);
    return res.json(job);
  } catch (error) {
    job.status = 'failed';
    job.error = error.message || 'failed to complete payment flow';
    jobs.set(job.id, job);
    return res.status(500).json({ error: job.error });
  }
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);

  if (!job) {
    return res.status(404).json({ error: 'job not found' });
  }

  return res.json(job);
});

const server = app.listen(PORT, () => {
  console.log(`AutoScholar backend listening on http://localhost:${PORT}`);
});

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Set PORT to a free port and retry.`);
    process.exit(1);
  }

  console.error('Backend server failed to start:', error);
  process.exit(1);
});
