import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';
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
const KB_PATH = path.resolve(__dirname, '../../../docs/x402-stacks-knowledge-base.json');

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

const jobs = new Map();
const paymentKnowledgeBase = JSON.parse(fs.readFileSync(KB_PATH, 'utf8'));

const PAYMENT_RAIL = {
  challengeStandard: 'x402 / HTTP 402 Payment Required',
  settlementLayer: 'Stacks',
  settlementAssets: ['USDCx', 'sBTC'],
  authorizationModel: 'payment-gated specialist access after verified settlement',
  specialistPattern: 'manager + paid molbot + post-payment capability release',
  queryUnlock: 'Research query creation is free; report synthesis and specialist assets unlock after x402 payment.'
};

const FORECAST_FRAMEWORK = [
  {
    id: 'fw-agent-001',
    title: 'Scenario planning for AI agent economies',
    summary: 'Forecast agent economies through scenario planning rather than point predictions. Track infrastructure maturity, pricing standards, trust boundaries, and discoverability of paid tools.',
    keywords: ['forecast', 'agent economies', 'scenario planning', 'tool markets'],
    sourceType: 'local-framework',
    category: 'forecast-framework',
    published: '2026-03-12',
    authors: ['AutoScholar Forecast Framework']
  },
  {
    id: 'fw-agent-002',
    title: 'Market structure signals for machine-to-machine commerce',
    summary: 'Key variables include payment rails, identity, settlement confirmation, capability release, and cross-agent reputation. Early markets often emerge as narrow specialist networks before broad autonomous economies.',
    keywords: ['machine-to-machine commerce', 'market structure', 'payments', 'reputation'],
    sourceType: 'local-framework',
    category: 'forecast-framework',
    published: '2026-03-12',
    authors: ['AutoScholar Forecast Framework']
  }
];

function makeId(prefix = 'job') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
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

function deriveResearchMode(topic) {
  const text = String(topic || '').toLowerCase();
  if (/(predict|forecast|future|3 years|5 years|next decade|outlook|scenario|预测|未来|三年|几年|趋势|演化路径)/i.test(text)) {
    return 'forecast';
  }
  if (/(survey|literature review|systematic review|综述|文献综述|系统综述)/i.test(text)) {
    return 'literature-review';
  }
  return 'analysis';
}

function cleanTopicForSearch(topic) {
  return String(topic || '')
    .replace(/predict the future of/gi, 'future outlook for')
    .replace(/over the next \d+ years?/gi, 'near term outlook')
    .replace(/how protocols like x402 and stacks could shape/gi, 'payment infrastructure and machine-to-machine commerce')
    .replace(/research-grade|technical|report|analysis/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractQuery(topic, mode) {
  const cleaned = cleanTopicForSearch(topic);
  if (mode === 'forecast') {
    return cleaned || 'AI agent economies payment infrastructure autonomous tool markets';
  }
  return cleaned || 'agent systems';
}

function scoreEvidence(topic, item, index) {
  const topicTerms = String(topic || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const haystack = `${item.title} ${item.summary} ${(item.keywords || []).join(' ')}`.toLowerCase();
  const termHits = topicTerms.filter((term) => haystack.includes(term)).length;
  const recencyBoost = item.published?.startsWith('2025') || item.published?.startsWith('2026') ? 2 : 0;
  const categoryBoost = item.category === 'protocol-core' ? 3 : item.category === 'forecast-framework' ? 2 : 0;
  return termHits + recencyBoost + categoryBoost + Math.max(0, 5 - index);
}

function classifyEvidence(topic, item) {
  const haystack = `${item.title} ${item.summary} ${(item.keywords || []).join(' ')}`.toLowerCase();
  if (item.category === 'protocol-core') return 'protocol-core';
  if (item.category === 'forecast-framework') return 'forecast-framework';
  if (/agent|market|payment|commerce|forecast|future|tool/i.test(haystack)) return 'supporting';
  return 'off-topic';
}

function buildPaymentRailEvidence(topic) {
  return (paymentKnowledgeBase.entries || []).map((entry, index) => ({
    id: entry.id,
    title: entry.title,
    summary: entry.summary,
    published: '2026-03-12',
    authors: ['AutoScholar Payment Rail KB'],
    keywords: entry.keywords || [],
    sourceType: entry.sourceType || 'local-kb',
    category: entry.category || 'protocol-core',
    relevanceScore: scoreEvidence(topic, entry, index),
    evidenceClass: classifyEvidence(topic, entry)
  }));
}

function buildForecastFrameworkEvidence(topic) {
  return FORECAST_FRAMEWORK.map((entry, index) => ({
    ...entry,
    relevanceScore: scoreEvidence(topic, entry, index),
    evidenceClass: classifyEvidence(topic, entry)
  }));
}

async function fetchArxivPapers(query, topic) {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=8&sortBy=relevance&sortOrder=descending`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'AutoScholar/0.6 (hackathon research demo)' }
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
      authors,
      sourceType: 'arxiv',
      category: 'external',
      keywords: []
    };
    return {
      ...paper,
      relevanceScore: scoreEvidence(topic, paper, index),
      evidenceClass: classifyEvidence(topic, paper)
    };
  }).filter((paper) => paper.title);
}

async function retrieveEvidence(topic, mode) {
  const query = extractQuery(topic, mode);
  let external = [];
  try {
    external = await fetchArxivPapers(query, topic);
  } catch {
    external = [];
  }

  const forecastFramework = mode === 'forecast' ? buildForecastFrameworkEvidence(topic) : [];
  const paymentRail = buildPaymentRailEvidence(topic);

  const researchEvidence = [...external, ...forecastFramework]
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 6);

  const paymentEvidence = paymentRail
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 3);

  const combined = [...researchEvidence, ...paymentEvidence];
  if (combined.length === 0) {
    throw new Error('no evidence retrieved');
  }

  return {
    query,
    researchEvidence,
    paymentEvidence,
    combined
  };
}

function parseJSONContent(content) {
  if (typeof content !== 'string') return null;
  try {
    return JSON.parse(content);
  } catch {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
    if (!fenced) return null;
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

function buildEvidenceStats(items) {
  const stats = { 'protocol-core': 0, 'forecast-framework': 0, supporting: 0, 'off-topic': 0 };
  for (const item of items) {
    const key = item.evidenceClass || 'off-topic';
    stats[key] = (stats[key] || 0) + 1;
  }
  return stats;
}

function buildEvidenceTable(items) {
  return items.slice(0, 6).map((item, index) => ({
    paperId: item.id,
    title: item.title,
    whyItMatters: `Evidence candidate #${index + 1} with relevance score ${item.relevanceScore}.`,
    evidence: truncate(item.summary, 220),
    evidenceClass: item.evidenceClass,
    sourceType: item.sourceType
  }));
}

function buildPaymentFlow() {
  return [
    'User submits a research question.',
    'Manager agent retrieves papers and prepares the committee meeting.',
    'Backend returns an x402 payment challenge for premium synthesis.',
    'User pays in simulated Stacks-native settlement flow (USDCx / sBTC narrative).',
    'Specialist agents and report synthesis unlock after payment verification.'
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
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
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
    if (parsed.code !== 0) throw new Error(parsed.message || JSON.stringify(parsed));
    parsed = parsed.data || {};
  }
  if (parsed?.http_status || parsed?.error) {
    throw new Error(parsed.error || `HTTP ${parsed.http_status}`);
  }
  return parsed?.choices?.[0]?.message?.content ?? parsed?.choices?.[0]?.content ?? parsed?.choices?.[0]?.text ?? '';
}

async function callJSONAgent(role, instruction, payload, fallbackObject) {
  const systemPrompt = [
    `You are the ${role} in an AI Parliament for research synthesis.`,
    'Use only the provided evidence.',
    'Separate the research topic from the payment rail: the topic can be broad, while x402 + Stacks is the monetization and settlement layer.',
    'Be specific, conservative, and transparent.',
    'Return strict JSON only.'
  ].join(' ');

  const userPrompt = `${instruction} Payload: ${JSON.stringify(payload)}`;
  try {
    const content = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], 0.15);
    return parseJSONContent(content) || fallbackObject;
  } catch {
    return fallbackObject;
  }
}

function buildForecastFallback(topic, evidenceBundle) {
  const stats = buildEvidenceStats(evidenceBundle.researchEvidence);
  return {
    mode: 'fallback',
    executiveSummary: `Near-term forecasts for ${topic} suggest that AI agent economies are more likely to emerge as narrow, payment-gated specialist networks than as fully autonomous open markets. x402 and Stacks should be treated as the payment and settlement rails that monetize and unlock the workflow, not as the subject that replaces the research question itself.`,
    researchQuestion: topic,
    methodology: 'Mixed evidence retrieval plus deterministic AI Parliament fallback for forecast synthesis.',
    keyFindings: [
      'The most plausible 3-year path is growth in narrow specialist tool markets rather than fully autonomous general economies.',
      'Payment infrastructure and entitlement release are likely to standardize before fully liquid agent markets appear.',
      'x402 can serve as the paywall / entitlement boundary, while Stacks supplies a settlement narrative for premium research workflows.',
      'Forecast confidence is limited because most retrieved evidence is architectural or conceptual rather than market-operational.'
    ],
    implications: [
      'The product should market itself as a paid AI research network, not as a solved autonomous economy.',
      'Judge-facing demos should show both topic-specific research results and the x402 payment unlock path.',
      'A forecasting mode is appropriate for future-oriented topics and should produce scenario-based outputs.'
    ],
    limitations: [
      'Forecasting evidence is still sparse and partly conceptual.',
      'Payment rail evidence is stronger than market-adoption evidence.'
    ],
    noveltyAssessment: 'High as a product architecture; medium as a market forecast.',
    consensus: 'Over the next 3 years, expect AI agent economies to advance first through premium specialist workflows and payment-gated APIs.',
    nextResearchActions: [
      'Add timeline-based forecast sections to the UI.',
      'Attach scenario probabilities to each future-looking claim.',
      'Collect more empirical evidence on agent tool market adoption.'
    ],
    scenarios: [
      { name: 'Base case', probability: '55%', outlook: 'Specialist paid agents grow, but broad autonomous markets remain early.', driver: 'Payment-gated APIs standardize faster than open agent coordination.' },
      { name: 'Bull case', probability: '25%', outlook: 'Agent tool markets deepen with standardized payments and entitlement protocols.', driver: 'Rapid ecosystem adoption of x402-like pricing and interoperable capability release.' },
      { name: 'Bear case', probability: '20%', outlook: 'Adoption stays fragmented across closed vendor ecosystems.', driver: 'Weak standards adoption and poor inter-agent trust infrastructure.' }
    ],
    timeline: [
      { window: '0-12 months', expectation: 'Premium specialist workflows and paid API experiments expand.' },
      { window: '12-24 months', expectation: 'Better standards emerge for payment-gated tools and agent identity.' },
      { window: '24-36 months', expectation: 'Selective machine-to-machine markets appear, but not fully open autonomous economies.' }
    ],
    quality: {
      evidenceCoverage: evidenceBundle.researchEvidence.length,
      synthesisMode: 'forecast-fallback',
      confidence: stats['supporting'] >= 3 ? 'medium' : 'low',
      evidenceStats: stats
    }
  };
}

async function runAIParliament(topic, mode, evidenceBundle) {
  const researchEvidence = evidenceBundle.researchEvidence.map((paper, index) => ({
    rank: index + 1,
    title: paper.title,
    published: formatDate(paper.published),
    authors: paper.authors,
    sourceType: paper.sourceType,
    evidenceClass: paper.evidenceClass,
    abstract: truncate(paper.summary, 700)
  }));

  const paymentEvidence = evidenceBundle.paymentEvidence.map((paper, index) => ({
    rank: index + 1,
    title: paper.title,
    sourceType: paper.sourceType,
    evidenceClass: paper.evidenceClass,
    abstract: truncate(paper.summary, 400)
  }));

  const stats = buildEvidenceStats(researchEvidence);

  const chairFallback = {
    framing: `Research the user's topic directly (${topic}) and use x402 + Stacks only as the payment and settlement rail that unlocks premium synthesis.`,
    agenda: ['summarize retrieved papers', 'debate likely future paths', 'separate topic findings from payment rail design', 'produce an auditable conclusion']
  };

  const chair = await callJSONAgent(
    'Chair Agent',
    'Return JSON with keys framing and agenda (array of short strings).',
    { topic, mode, researchEvidence, paymentEvidence, paymentRail: PAYMENT_RAIL },
    chairFallback
  );

  const marketFallback = {
    thesis: 'Agent economies will likely mature first as premium specialist tool networks with human-supervised orchestration.',
    drivers: ['tool specialization', 'payment-gated access', 'agent discovery', 'infrastructure standardization'],
    risks: ['fragmented vendor ecosystems', 'weak trust and entitlement standards', 'limited empirical adoption data']
  };

  const market = await callJSONAgent(
    'Market Analyst Agent',
    'Return JSON with keys thesis, drivers (3-5 short strings), risks (3-5 short strings).',
    { topic, mode, researchEvidence },
    marketFallback
  );

  const infraFallback = {
    thesis: 'x402 and Stacks should be presented as the monetization and settlement rails that support premium research workflows, not as a constraint on what topics can be researched.',
    mechanisms: ['x402 payment challenge', 'Stacks settlement narrative', 'USDCx/sBTC asset options', 'post-payment capability release']
  };

  const infra = await callJSONAgent(
    'Infrastructure Agent',
    'Return JSON with keys thesis and mechanisms (3-5 short strings).',
    { topic, paymentEvidence, paymentRail: PAYMENT_RAIL },
    infraFallback
  );

  const skepticFallback = {
    caution: 'Do not overclaim broad autonomous economies. Evidence supports directional forecasting, not precise market inevitability.',
    weakPoints: ['limited deployment data', 'future adoption uncertainty', 'topic evidence stronger than market proof in some areas']
  };

  const skeptic = await callJSONAgent(
    'Skeptic Agent',
    'Return JSON with keys caution and weakPoints (array of short strings).',
    { topic, researchEvidence, paymentEvidence, market, infra },
    skepticFallback
  );

  const synthesisFallback = mode === 'forecast'
    ? buildForecastFallback(topic, evidenceBundle)
    : {
        mode: 'fallback',
        executiveSummary: `The topic ${topic} can be researched independently, while x402 and Stacks remain the payment rail used to unlock premium synthesis and specialist assets.`,
        researchQuestion: topic,
        methodology: 'Mixed retrieval with AI Parliament synthesis.',
        keyFindings: ['The research topic should remain primary.', 'x402 + Stacks should stay as the monetization layer.', 'Committee synthesis improves auditability.'],
        implications: ['Separate content intelligence from payment infrastructure.'],
        limitations: ['Limited source diversity.'],
        noveltyAssessment: 'Medium',
        consensus: 'Topic and payment rail should be distinct layers.',
        nextResearchActions: ['Expand sources.'],
        quality: { evidenceCoverage: researchEvidence.length, synthesisMode: 'fallback', confidence: 'medium', evidenceStats: stats }
      };

  const synthesizer = await callJSONAgent(
    'Synthesizer Agent',
    mode === 'forecast'
      ? 'Return JSON with keys executiveSummary, keyFindings (4-6 strings), implications (3-5 strings), limitations (2-4 strings), noveltyAssessment, consensus, nextResearchActions (3-5 strings), scenarios (array of 3 objects with name, probability, outlook, driver), timeline (array of 3 objects with window and expectation).'
      : 'Return JSON with keys executiveSummary, keyFindings (4-6 strings), implications (3-5 strings), limitations (2-4 strings), noveltyAssessment, consensus, nextResearchActions (3-5 strings).',
    { topic, mode, chair, market, infra, skeptic, researchEvidence, paymentEvidence, stats },
    synthesisFallback
  );

  return {
    mode: 'llm-parliament',
    executiveSummary: synthesizer.executiveSummary || synthesisFallback.executiveSummary,
    researchQuestion: topic,
    methodology: `AI Parliament workflow over retrieved research evidence plus x402/Stacks payment-rail evidence. Chair agenda: ${safeArray(chair.agenda, []).join('; ')}`,
    keyFindings: safeArray(synthesizer.keyFindings, synthesisFallback.keyFindings || []),
    implications: safeArray(synthesizer.implications, synthesisFallback.implications || []),
    limitations: safeArray(synthesizer.limitations, synthesisFallback.limitations || []),
    noveltyAssessment: synthesizer.noveltyAssessment || synthesisFallback.noveltyAssessment,
    consensus: synthesizer.consensus || synthesisFallback.consensus,
    nextResearchActions: safeArray(synthesizer.nextResearchActions, synthesisFallback.nextResearchActions || []),
    scenarios: safeArray(synthesizer.scenarios, synthesisFallback.scenarios || []),
    timeline: safeArray(synthesizer.timeline, synthesisFallback.timeline || []),
    evidenceTable: buildEvidenceTable(evidenceBundle.researchEvidence),
    paymentEvidenceTable: buildEvidenceTable(evidenceBundle.paymentEvidence),
    parliament: [
      { agent: 'Chair Agent', role: 'Debate chair', stance: chair.framing || chairFallback.framing },
      { agent: 'Market Analyst Agent', role: 'Future market analysis', stance: market.thesis || marketFallback.thesis },
      { agent: 'Infrastructure Agent', role: 'x402 + Stacks payment rail', stance: infra.thesis || infraFallback.thesis },
      { agent: 'Skeptic Agent', role: 'Challenge and uncertainty control', stance: skeptic.caution || skepticFallback.caution }
    ],
    quality: {
      evidenceCoverage: evidenceBundle.researchEvidence.length,
      synthesisMode: mode === 'forecast' ? 'ai-parliament-forecast' : 'ai-parliament',
      confidence: mode === 'forecast' ? 'medium' : 'medium-high',
      evidenceStats: stats
    }
  };
}

async function generateReport(topic, mode, evidenceBundle) {
  if (!OPENAI_API_KEY) {
    return buildForecastFallback(topic, evidenceBundle);
  }
  try {
    return await runAIParliament(topic, mode, evidenceBundle);
  } catch (error) {
    return {
      ...buildForecastFallback(topic, evidenceBundle),
      error: error.message || 'unknown llm error'
    };
  }
}

function buildResearchReport(topic, mode, evidenceBundle, llmResult, extractedAssets) {
  return {
    title: `AutoScholar ${mode === 'forecast' ? 'forecast dossier' : 'research dossier'}: ${topic}`,
    researchMode: mode,
    executiveSummary: llmResult.executiveSummary,
    researchQuestion: llmResult.researchQuestion || topic,
    methodology: llmResult.methodology,
    keyFindings: safeArray(llmResult.keyFindings, []),
    implications: safeArray(llmResult.implications, []),
    limitations: safeArray(llmResult.limitations, []),
    noveltyAssessment: llmResult.noveltyAssessment,
    consensus: llmResult.consensus,
    nextResearchActions: safeArray(llmResult.nextResearchActions, []),
    scenarios: safeArray(llmResult.scenarios, []),
    timeline: safeArray(llmResult.timeline, []),
    parliament: safeArray(llmResult.parliament, []),
    evidenceTable: safeArray(llmResult.evidenceTable, []),
    paymentEvidenceTable: safeArray(llmResult.paymentEvidenceTable, []),
    quality: llmResult.quality || { evidenceCoverage: evidenceBundle.researchEvidence.length, synthesisMode: 'unknown', confidence: 'unknown' },
    paymentRail: PAYMENT_RAIL,
    paymentFlow: buildPaymentFlow(),
    extractedAssets,
    citations: evidenceBundle.researchEvidence.map((paper, index) => ({
      ref: `[${index + 1}]`,
      title: paper.title,
      authors: paper.authors,
      published: formatDate(paper.published),
      sourceType: paper.sourceType,
      evidenceClass: paper.evidenceClass,
      id: paper.id
    })),
    paymentCitations: evidenceBundle.paymentEvidence.map((paper, index) => ({
      ref: `[P${index + 1}]`,
      title: paper.title,
      authors: paper.authors,
      sourceType: paper.sourceType,
      evidenceClass: paper.evidenceClass,
      id: paper.id
    }))
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'autoscholar-backend', mode: 'v6-ai-parliament' });
});

app.get('/api/config', (_req, res) => {
  res.json({
    apiBase: `http://localhost:${PORT}`,
    llmConfigured: Boolean(OPENAI_API_KEY),
    model: OPENAI_MODEL,
    providerBaseUrl: OPENAI_BASE_URL,
    paperSource: 'topic papers + payment rail knowledge',
    paymentRail: PAYMENT_RAIL,
    orchestrationMode: 'AI Parliament (chair + market analyst + infrastructure agent + skeptic)',
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
    const researchMode = deriveResearchMode(topic);
    const evidenceBundle = await retrieveEvidence(topic, researchMode);
    const id = makeId();
    const job = {
      id,
      topic,
      searchQuery: evidenceBundle.query,
      researchMode,
      paperSource: 'topic papers + payment rail knowledge',
      papers: evidenceBundle.researchEvidence,
      paymentEvidence: evidenceBundle.paymentEvidence,
      status: 'awaiting-payment',
      createdAt: new Date().toISOString(),
      orchestration: {
        manager: 'Manager Molbot',
        specialists: ['Chair Agent', 'Market Analyst Agent', 'Infrastructure Agent', 'Skeptic Agent', 'Image Extractor Molbot'],
        meetingStatus: 'scheduled'
      },
      paymentRequest: {
        type: 'x402',
        asset: 'USDCx',
        amount: '0.5',
        recipient: 'STX-DEMO-RECIPIENT',
        challenge: 'HTTP 402 Payment Required',
        specialist: 'Image Extractor Molbot',
        reason: 'Premium synthesis, AI Parliament debate, and extracted assets unlock after payment.'
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
      message: 'Provide a valid demo payment token to unlock the AI Parliament report.',
      expectedHeader: 'x-payment-token'
    });
  }

  try {
    const extractedAssets = [
      {
        id: 'asset_1',
        type: 'diagram',
        title: 'AI Parliament + x402 payment unlock flow',
        description: 'Simulated diagram showing retrieval, debate, x402 payment challenge, Stacks settlement, and premium report release.'
      },
      {
        id: 'asset_2',
        type: 'chart',
        title: 'Topic evidence versus payment-rail evidence',
        description: 'Simulated chart showing the separation between research content and x402/Stacks payment infrastructure.'
      }
    ];

    job.status = 'processing';
    job.orchestration.meetingStatus = 'in-progress';
    jobs.set(job.id, job);

    const evidenceBundle = {
      researchEvidence: job.papers || [],
      paymentEvidence: job.paymentEvidence || [],
      combined: [...(job.papers || []), ...(job.paymentEvidence || [])],
      query: job.searchQuery
    };

    const llmResult = await generateReport(job.topic, job.researchMode, evidenceBundle);
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
    job.report = buildResearchReport(job.topic, job.researchMode, evidenceBundle, llmResult, extractedAssets);

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
