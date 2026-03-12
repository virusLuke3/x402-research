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
  return String(topic || '')
    .replace(/summarize|latest|papers|paper|include|core|architecture|diagrams|diagram|research|report/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'ZK Rollup';
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

async function fetchArxivPapers(query, topic) {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=6&sortBy=relevance&sortOrder=descending`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'AutoScholar/0.2 (hackathon research demo)'
    }
  });

  if (!response.ok) {
    throw new Error(`arXiv request failed with status ${response.status}`);
  }

  const xml = await response.text();
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => match[1]);

  return entries.map((entry, index) => {
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

function buildLocalFallbackSummary(topic, papers, reason = 'LLM unavailable') {
  const topPapers = papers.slice(0, 3);
  return {
    mode: 'fallback',
    executiveSummary: `${reason}. Returning a locally generated research brief for ${topic}.`,
    researchQuestion: topic,
    methodology: 'Fallback synthesis from arXiv metadata, relevance scoring, and deterministic manager heuristics.',
    keyFindings: topPapers.map((paper) => `${paper.title} — ${truncate(paper.summary, 180)}`),
    implications: [
      'Provider credentials should be validated before live demo runs.',
      'Fallback mode preserves the research pipeline but lowers synthesis quality and nuance.'
    ],
    limitations: [
      'No model-driven cross-paper synthesis was produced.',
      'Findings were distilled from metadata and abstracts only.'
    ],
    evidenceTable: topPapers.map((paper, index) => ({
      paperId: paper.id,
      title: paper.title,
      whyItMatters: `High-relevance candidate #${index + 1} for the requested topic.`,
      evidence: truncate(paper.summary, 220)
    })),
    agentDebate: buildAgentDebate(topic, topPapers),
    consensus: 'Use the shortlisted papers as the minimal evidence pack until LLM synthesis is restored.',
    noveltyAssessment: 'Medium: adequate for demo continuity, weak for judge-facing academic polish.',
    nextResearchActions: [
      'Repair provider authentication and rerun synthesis.',
      'Download PDFs and extract diagrams for stronger evidence grounding.',
      'Add a critic pass that checks overclaims against cited abstracts.'
    ]
  };
}

function buildAgentDebate(topic, papers) {
  const lead = papers[0];
  const second = papers[1];
  const third = papers[2];

  return [
    {
      agent: 'Planner Agent',
      role: 'Scope and decomposition',
      stance: `The core question is: ${topic}. We should prioritize papers with explicit system architecture, proving pipeline, or benchmarking evidence.`
    },
    {
      agent: 'Retriever Agent',
      role: 'Evidence gathering',
      stance: lead ? `The strongest retrieval candidate is “${lead.title}”, supported by ${lead.authors?.slice(0, 3).join(', ') || 'unknown authors'} and published on ${formatDate(lead.published)}.` : 'No strong retrieval candidate was found.'
    },
    {
      agent: 'Skeptic Agent',
      role: 'Challenge weak claims',
      stance: second ? `Avoid claiming general superiority. The abstract of “${second.title}” supports only limited conclusions, mostly around ${truncate(second.summary, 120)}.` : 'Claims should be kept conservative because evidence coverage is thin.'
    },
    {
      agent: 'Synthesis Agent',
      role: 'Cross-paper synthesis',
      stance: third ? `A reasonable synthesis is that current work converges on modular proving systems, sequencer/prover separation, and practical deployment tradeoffs, with “${third.title}” reinforcing that theme.` : 'Synthesis should stay at the level of recurring system motifs and not overstate consensus.'
    }
  ];
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

  return parsed;
}

async function generateLLMSummary(topic, papers) {
  if (!OPENAI_API_KEY) {
    return buildLocalFallbackSummary(topic, papers, 'OpenAI-compatible key not configured');
  }

  const evidencePack = papers.slice(0, 5).map((paper, index) => ({
    rank: index + 1,
    title: paper.title,
    published: formatDate(paper.published),
    authors: paper.authors,
    relevanceScore: paper.relevanceScore,
    abstract: truncate(paper.summary, 800)
  }));

  const systemPrompt = [
    'You are the chair of an academic multi-agent research committee.',
    'Your job is to synthesize a rigorous, conservative research report from the supplied arXiv evidence only.',
    'Do not invent citations, figures, experiments, or claims unsupported by the provided evidence.',
    'Prefer nuanced, hedge-aware wording over hype.',
    'Return strict JSON only.'
  ].join(' ');

  const userPrompt = [
    `Research topic: ${topic}`,
    `Evidence pack: ${JSON.stringify(evidencePack)}`,
    'Return JSON with keys:',
    'executiveSummary (string),',
    'researchQuestion (string),',
    'methodology (string),',
    'keyFindings (array of 4-8 strings),',
    'evidenceTable (array of objects with title, whyItMatters, evidence),',
    'agentDebate (array of 4 objects with agent, role, stance),',
    'consensus (string),',
    'limitations (array of 2-5 strings),',
    'implications (array of 3-6 strings),',
    'noveltyAssessment (string),',
    'nextResearchActions (array of 3-6 strings).',
    'Make the report sound like a careful research memo, not marketing copy.'
  ].join(' ');

  try {
    const parsed = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    const content = parsed?.choices?.[0]?.message?.content ?? parsed?.choices?.[0]?.content ?? parsed?.choices?.[0]?.text ?? '';
    const result = parseJSONContent(content);

    if (result) {
      return { mode: 'llm-python', ...result };
    }

    return {
      mode: 'llm-python',
      ...buildLocalFallbackSummary(topic, papers, 'LLM returned unstructured content'),
      rawContent: content
    };
  } catch (error) {
    return {
      ...buildLocalFallbackSummary(topic, papers, 'LLM request errored'),
      error: error.message || 'unknown llm error'
    };
  }
}

function buildResearchReport(topic, papers, llmResult, extractedAssets) {
  return {
    title: `AutoScholar research dossier: ${topic}`,
    executiveSummary: llmResult.executiveSummary || llmResult.summary || 'No summary generated.',
    researchQuestion: llmResult.researchQuestion || topic,
    methodology: llmResult.methodology || 'arXiv retrieval, manager triage, paid specialist unlock, and model-based synthesis.',
    keyFindings: llmResult.keyFindings || [],
    evidenceTable: llmResult.evidenceTable || [],
    agentDebate: llmResult.agentDebate || buildAgentDebate(topic, papers),
    consensus: llmResult.consensus || 'The evidence suggests a cautious synthesis rather than a single dominant conclusion.',
    limitations: llmResult.limitations || [],
    implications: llmResult.implications || [],
    noveltyAssessment: llmResult.noveltyAssessment || 'Unknown',
    nextResearchActions: llmResult.nextResearchActions || [],
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
    orchestrationMode: 'manager + planner + retriever + skeptic + synthesis',
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
        specialists: ['Planner Agent', 'Retriever Agent', 'Skeptic Agent', 'Synthesis Agent', 'Image Extractor Molbot'],
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
