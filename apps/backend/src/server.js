import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import { buildStacksPaymentRequest, verifyStacksPayment, STACKS_NETWORK, STACKS_API_BASE } from './stacks.js';
import { buildX402Challenge, buildX402Headers } from './x402.js';

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
  queryUnlock: 'Research query creation is free; report synthesis, debate transcripts, and specialist assets unlock after x402 payment.',
  stacks: {
    network: STACKS_NETWORK,
    apiBase: STACKS_API_BASE,
    verificationMode: 'real-ready-scaffold'
  }
};

const TOPIC_FRAMEWORKS = {
  forecast: [
    {
      id: 'fw-forecast-001',
      title: 'Scenario planning for frontier software ecosystems',
      summary: 'Forecast through scenarios rather than single-point predictions. Track adoption friction, standardization pressure, monetization rails, and trust boundaries.',
      keywords: ['forecast', 'scenario', 'future', 'adoption'],
      sourceType: 'local-framework',
      category: 'topic-framework',
      published: '2026-03-12',
      authors: ['AutoScholar Topic Framework']
    },
    {
      id: 'fw-forecast-002',
      title: 'Market structure signals for machine-to-machine commerce',
      summary: 'Key variables include payment rails, identity, discovery, service pricing, and post-payment capability release. Early ecosystems usually emerge in narrow specialist niches before generalized open markets.',
      keywords: ['market structure', 'agent economy', 'payments', 'tool markets'],
      sourceType: 'local-framework',
      category: 'topic-framework',
      published: '2026-03-12',
      authors: ['AutoScholar Topic Framework']
    }
  ],
  solidity: [
    {
      id: 'fw-sol-001',
      title: 'Solidity vulnerability taxonomy and exploit surface mapping',
      summary: 'A topic scaffold covering reentrancy, access control failures, oracle manipulation, integer/precision pitfalls, upgradeability hazards, denial-of-service vectors, and unsafe external calls.',
      keywords: ['solidity', 'smart contract', 'vulnerability', 'reentrancy', 'audit'],
      sourceType: 'local-framework',
      category: 'topic-framework',
      published: '2026-03-12',
      authors: ['AutoScholar Topic Framework']
    },
    {
      id: 'fw-sol-002',
      title: 'Security review patterns for Solidity systems',
      summary: 'Security analysis should separate vulnerability class, exploit preconditions, realistic attack path, impact, mitigation pattern, and whether the issue is mostly architectural or implementation-specific.',
      keywords: ['solidity', 'security review', 'exploit path', 'mitigation', 'audit checklist'],
      sourceType: 'local-framework',
      category: 'topic-framework',
      published: '2026-03-12',
      authors: ['AutoScholar Topic Framework']
    }
  ],
  general: [
    {
      id: 'fw-general-001',
      title: 'General deep research workflow scaffold',
      summary: 'A general-purpose scaffold for literature search, relevance filtering, skeptical review, and synthesis for arbitrary research topics.',
      keywords: ['literature review', 'research workflow', 'analysis'],
      sourceType: 'local-framework',
      category: 'topic-framework',
      published: '2026-03-12',
      authors: ['AutoScholar Topic Framework']
    }
  ]
};

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

function deriveTopicProfile(topic) {
  const text = String(topic || '').toLowerCase();
  if (/(solidity|smart contract|reentrancy|erc-20|erc20|defi|evm|合约|漏洞|审计|重入)/i.test(text)) {
    return {
      key: 'solidity',
      label: 'Solidity Security Research',
      description: 'Topic-specific security research on Solidity vulnerabilities, exploit paths, and mitigations.',
      retrieverHint: 'solidity vulnerabilities smart contract security audit exploit reentrancy access control',
      specialistRoles: [
        { agent: 'Chair Agent', role: 'Debate chair' },
        { agent: 'Security Researcher Agent', role: 'Vulnerability taxonomy and evidence review' },
        { agent: 'Exploit Analyst Agent', role: 'Attack path and exploit realism analysis' },
        { agent: 'Audit Skeptic Agent', role: 'Challenge weak or overclaimed security conclusions' }
      ]
    };
  }

  if (deriveResearchMode(topic) === 'forecast') {
    return {
      key: 'forecast',
      label: 'Forecast Research',
      description: 'Future-oriented research with scenario analysis and timeline synthesis.',
      retrieverHint: 'future outlook trend scenario market evolution adoption',
      specialistRoles: [
        { agent: 'Chair Agent', role: 'Debate chair' },
        { agent: 'Market Analyst Agent', role: 'Future market analysis' },
        { agent: 'Infrastructure Agent', role: 'Infrastructure and monetization rail analysis' },
        { agent: 'Skeptic Agent', role: 'Challenge and uncertainty control' }
      ]
    };
  }

  return {
    key: 'general',
    label: 'General Deep Research',
    description: 'Topic-agnostic literature synthesis with skeptical review.',
    retrieverHint: 'research papers literature analysis',
    specialistRoles: [
      { agent: 'Chair Agent', role: 'Debate chair' },
      { agent: 'Research Analyst Agent', role: 'Topic evidence synthesis' },
      { agent: 'Method Skeptic Agent', role: 'Challenge weak methods and overclaims' },
      { agent: 'Synthesis Agent', role: 'Final report integration' }
    ]
  };
}

function cleanTopicForSearch(topic) {
  return String(topic || '')
    .replace(/predict the future of/gi, 'future outlook for')
    .replace(/over the next \d+ years?/gi, 'near term outlook')
    .replace(/研究关于/gi, '')
    .replace(/我想研究/gi, '')
    .replace(/research-grade|technical|report|analysis/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractQuery(topic, researchMode, topicProfile) {
  const cleaned = cleanTopicForSearch(topic);
  if (topicProfile.key === 'solidity') {
    return cleaned || topicProfile.retrieverHint;
  }
  if (researchMode === 'forecast') {
    return cleaned || topicProfile.retrieverHint;
  }
  return cleaned || topicProfile.retrieverHint;
}

function scoreEvidence(topic, item, index) {
  const topicTerms = String(topic || '').toLowerCase().split(/[^a-z0-9\u4e00-\u9fff]+/).filter(Boolean);
  const haystack = `${item.title} ${item.summary} ${(item.keywords || []).join(' ')}`.toLowerCase();
  const termHits = topicTerms.filter((term) => haystack.includes(term)).length;
  const recencyBoost = item.published?.startsWith('2025') || item.published?.startsWith('2026') ? 2 : 0;
  const categoryBoost = item.category === 'protocol-core' ? 3 : item.category === 'topic-framework' ? 2 : 0;
  return termHits + recencyBoost + categoryBoost + Math.max(0, 5 - index);
}

function classifyEvidence(topicProfile, item) {
  const haystack = `${item.title} ${item.summary} ${(item.keywords || []).join(' ')}`.toLowerCase();
  if (item.category === 'protocol-core') return 'payment-rail';
  if (item.category === 'topic-framework') return 'topic-framework';
  if (topicProfile.key === 'solidity' && /solidity|contract|reentrancy|audit|exploit|evm|defi/.test(haystack)) return 'topic-core';
  if (topicProfile.key === 'forecast' && /forecast|future|market|trend|agent|commerce|payment/.test(haystack)) return 'topic-core';
  if (/agent|market|security|contract|payment|future|analysis|review/.test(haystack)) return 'supporting';
  return 'off-topic';
}

function buildTopicFrameworkEvidence(topic, topicProfile) {
  return (TOPIC_FRAMEWORKS[topicProfile.key] || TOPIC_FRAMEWORKS.general).map((entry, index) => ({
    ...entry,
    relevanceScore: scoreEvidence(topic, entry, index),
    evidenceClass: classifyEvidence(topicProfile, entry)
  }));
}

function buildPaymentRailEvidence(topic, topicProfile) {
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
    evidenceClass: classifyEvidence(topicProfile, { ...entry, category: entry.category || 'protocol-core' })
  }));
}

async function fetchArxivPapers(query, topic, topicProfile) {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=8&sortBy=relevance&sortOrder=descending`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'AutoScholar/0.6.1 (hackathon research demo)' }
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
      evidenceClass: classifyEvidence(topicProfile, paper)
    };
  }).filter((paper) => paper.title);
}

async function retrieveEvidence(topic, researchMode, topicProfile) {
  const query = extractQuery(topic, researchMode, topicProfile);
  let external = [];
  try {
    external = await fetchArxivPapers(query, topic, topicProfile);
  } catch {
    external = [];
  }

  const topicFramework = buildTopicFrameworkEvidence(topic, topicProfile);
  const paymentRail = buildPaymentRailEvidence(topic, topicProfile);

  const topicEvidence = [...external, ...topicFramework]
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 6);

  const paymentEvidence = paymentRail
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 3);

  const combined = [...topicEvidence, ...paymentEvidence];
  if (combined.length === 0) {
    throw new Error('no evidence retrieved');
  }

  return {
    query,
    topicEvidence,
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
  const stats = { 'topic-core': 0, 'topic-framework': 0, supporting: 0, 'payment-rail': 0, 'off-topic': 0 };
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
    'User submits an arbitrary research question.',
    'Manager agent retrieves topic evidence and prepares the committee meeting.',
    'Backend returns an x402 payment challenge carrying Stacks settlement details.',
    'User pays through a Stacks settlement path (USDCx / sBTC / STX-compatible narrative depending on configuration).',
    'Backend verifies the Stacks payment proof / txid and unlocks specialist outputs after verification.'
  ];
}

function buildAgentIdentity(roleSpec, topicProfile) {
  return {
    agent: roleSpec.agent,
    role: roleSpec.role,
    persona: `${roleSpec.agent} is part of the ${topicProfile.label} panel and must stay within its remit.`,
    authority: roleSpec.role,
    paymentCapability: roleSpec.agent === 'Chair Agent' ? 'can-request-premium-synthesis' : 'advisory-only'
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

async function callJSONAgent(agent, role, instruction, payload, fallbackObject) {
  const systemPrompt = [
    `You are ${agent}, serving as ${role} in an AI Parliament for deep research.`,
    'Use only the provided evidence.',
    'Treat the research topic and the x402/Stacks payment rail as separate layers.',
    'Be specific, skeptical, and concise.',
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

function buildFallbackReport(topic, researchMode, topicProfile, evidenceBundle) {
  const stats = buildEvidenceStats(evidenceBundle.topicEvidence);

  if (topicProfile.key === 'solidity') {
    return {
      mode: 'fallback',
      executiveSummary: `Current evidence suggests Solidity security research should be organized around vulnerability classes, exploit preconditions, and mitigation patterns. The system can research Solidity vulnerabilities directly, while x402 + Stacks remains only the premium payment rail used to unlock the report.`,
      researchQuestion: topic,
      methodology: 'Topic-specific mixed retrieval plus deterministic security synthesis fallback.',
      keyFindings: [
        'Solidity vulnerability analysis is best structured as taxonomy + exploit path + mitigation.',
        'Reentrancy, access control, unsafe external calls, price/oracle assumptions, and upgradeability risks are recurrent security themes.',
        'Audit conclusions should distinguish architectural weaknesses from implementation bugs.',
        'x402 + Stacks belongs to the monetization layer, not the Solidity topic itself.'
      ],
      implications: [
        'The product can sell premium security research workflows without forcing the topic to be about the payment rail.',
        'Topic-specific agents improve the credibility of the summary.'
      ],
      limitations: [
        'Some evidence may still be generic smart contract security literature rather than Solidity-only.'
      ],
      noveltyAssessment: 'High as a product architecture; medium as a domain-specific review until more sources are added.',
      consensus: 'A topic-agnostic research agent should use domain-specific panels and keep x402 + Stacks as infrastructure.',
      nextResearchActions: [
        'Add explicit exploit-case retrievers for Solidity incident reports.',
        'Bind each vulnerability claim to evidence rows in the UI.',
        'Add an audit checklist export mode.'
      ],
      domainSections: {
        vulnerabilityTaxonomy: ['reentrancy', 'access control', 'oracle manipulation', 'upgradeability hazards', 'unsafe external calls'],
        mitigationPatterns: ['checks-effects-interactions', 'role separation', 'circuit breakers', 'invariant testing', 'upgrade review discipline']
      },
      quality: {
        evidenceCoverage: evidenceBundle.topicEvidence.length,
        synthesisMode: 'topic-fallback',
        confidence: stats['topic-core'] + stats['topic-framework'] >= 2 ? 'medium' : 'low',
        evidenceStats: stats
      }
    };
  }

  if (researchMode === 'forecast') {
    return {
      mode: 'fallback',
      executiveSummary: `Near-term forecasts for ${topic} suggest early growth in narrow specialist networks before broad autonomous markets emerge. x402 + Stacks should be treated as monetization and settlement rails for premium workflows, not as a replacement for the research topic.`,
      researchQuestion: topic,
      methodology: 'Mixed retrieval plus deterministic scenario synthesis fallback.',
      keyFindings: [
        'Specialist agent markets are likelier than fully open autonomous economies in the near term.',
        'Payment and entitlement standards may mature before rich inter-agent markets do.',
        'Forecasting should use scenarios rather than point predictions.',
        'x402 + Stacks belongs to the unlock layer, not the topic layer.'
      ],
      implications: ['The project should present itself as a premium research network with scenario analysis.'],
      limitations: ['Forecast evidence remains partially conceptual and not fully operational.'],
      noveltyAssessment: 'High as a product design; medium as a forecast certainty level.',
      consensus: 'Future-looking topics need scenario-based AI Parliament output, with payment rails treated separately.',
      nextResearchActions: ['Add topic-specific forecast retrievers.', 'Attach probabilities to future claims.'],
      scenarios: [
        { name: 'Base case', probability: '55%', outlook: 'Specialist paid agent workflows expand faster than open autonomous economies.', driver: 'Practical workflow monetization beats open-market coordination.' },
        { name: 'Bull case', probability: '25%', outlook: 'Standardized agent payments and discoverability accelerate ecosystem growth.', driver: 'Standards adoption and interoperable tooling improve quickly.' },
        { name: 'Bear case', probability: '20%', outlook: 'Fragmented closed ecosystems limit cross-agent commerce.', driver: 'Weak standards and trust infrastructure.' }
      ],
      timeline: [
        { window: '0-12 months', expectation: 'Paid agent workflows and premium tool APIs expand.' },
        { window: '12-24 months', expectation: 'Better standards emerge for pricing, identity, and access unlocks.' },
        { window: '24-36 months', expectation: 'Selective machine-to-machine commerce becomes viable in constrained niches.' }
      ],
      quality: {
        evidenceCoverage: evidenceBundle.topicEvidence.length,
        synthesisMode: 'forecast-fallback',
        confidence: stats['topic-core'] + stats['topic-framework'] >= 2 ? 'medium' : 'low',
        evidenceStats: stats
      }
    };
  }

  return {
    mode: 'fallback',
    executiveSummary: `The system can research the topic “${topic}” directly, while x402 + Stacks remains the premium payment rail that unlocks synthesis and specialist assets.`,
    researchQuestion: topic,
    methodology: 'Mixed retrieval plus deterministic topic-agnostic synthesis fallback.',
    keyFindings: [
      'The research topic should remain primary.',
      'The payment rail should remain infrastructure, not subject matter.',
      'Topic-specific agent panels improve auditability and relevance.'
    ],
    implications: ['A deep research product can support arbitrary topics while monetizing premium outputs through x402 + Stacks.'],
    limitations: ['Topic-specific source coverage still needs to grow.'],
    noveltyAssessment: 'High as a product architecture.',
    consensus: 'Topic and payment rail should stay decoupled.',
    nextResearchActions: ['Expand domain profiles and retrievers.'],
    quality: {
      evidenceCoverage: evidenceBundle.topicEvidence.length,
      synthesisMode: 'general-fallback',
      confidence: stats['topic-core'] + stats['topic-framework'] >= 2 ? 'medium' : 'low',
      evidenceStats: stats
    }
  };
}

async function runAIParliament(topic, researchMode, topicProfile, evidenceBundle) {
  const topicEvidence = evidenceBundle.topicEvidence.map((paper, index) => ({
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
  const stats = buildEvidenceStats(topicEvidence);
  const fallback = buildFallbackReport(topic, researchMode, topicProfile, evidenceBundle);

  const chair = await callJSONAgent(
    topicProfile.specialistRoles[0].agent,
    topicProfile.specialistRoles[0].role,
    'Return JSON with keys framing and agenda (array of short strings).',
    { topic, researchMode, topicProfile, topicEvidence, paymentEvidence, paymentRail: PAYMENT_RAIL },
    {
      framing: `Research the user topic directly (${topic}) and treat x402 + Stacks only as the premium payment and settlement rail.`,
      agenda: ['retrieve evidence', 'debate topic findings', 'separate content from payment rail', 'produce auditable conclusions']
    }
  );

  const memberOne = await callJSONAgent(
    topicProfile.specialistRoles[1].agent,
    topicProfile.specialistRoles[1].role,
    'Return JSON with keys thesis, keyPoints (3-5 short strings), and caveats (2-4 short strings).',
    { topic, researchMode, topicProfile, topicEvidence },
    {
      thesis: fallback.executiveSummary,
      keyPoints: fallback.keyFindings,
      caveats: fallback.limitations
    }
  );

  const memberTwo = await callJSONAgent(
    topicProfile.specialistRoles[2].agent,
    topicProfile.specialistRoles[2].role,
    'Return JSON with keys thesis, keyPoints (3-5 short strings), and caveats (2-4 short strings).',
    { topic, researchMode, topicProfile, topicEvidence, paymentEvidence, paymentRail: PAYMENT_RAIL },
    {
      thesis: `x402 + Stacks should stay in the infrastructure layer while the topic-specific analysis remains primary.`,
      keyPoints: ['Keep the payment rail separate from the research subject.', 'Use payment unlock to monetize premium analysis.'],
      caveats: ['Infrastructure evidence does not replace topic evidence.']
    }
  );

  const skeptic = await callJSONAgent(
    topicProfile.specialistRoles[3].agent,
    topicProfile.specialistRoles[3].role,
    'Return JSON with keys caution and weakPoints (array of short strings).',
    { topic, researchMode, topicProfile, topicEvidence, memberOne, memberTwo },
    {
      caution: 'Do not overclaim. Keep topic evidence distinct from payment-rail evidence.',
      weakPoints: fallback.limitations
    }
  );

  const synthesizerInstruction = researchMode === 'forecast'
    ? 'Return JSON with keys executiveSummary, keyFindings (4-6 strings), implications (3-5 strings), limitations (2-4 strings), noveltyAssessment, consensus, nextResearchActions (3-5 strings), scenarios (array of 3 objects with name, probability, outlook, driver), timeline (array of 3 objects with window and expectation).'
    : topicProfile.key === 'solidity'
      ? 'Return JSON with keys executiveSummary, keyFindings (4-6 strings), implications (3-5 strings), limitations (2-4 strings), noveltyAssessment, consensus, nextResearchActions (3-5 strings), domainSections (object with vulnerabilityTaxonomy array and mitigationPatterns array).'
      : 'Return JSON with keys executiveSummary, keyFindings (4-6 strings), implications (3-5 strings), limitations (2-4 strings), noveltyAssessment, consensus, nextResearchActions (3-5 strings).';

  const synthesizer = await callJSONAgent(
    'Synthesizer Agent',
    'Final report integration',
    synthesizerInstruction,
    { topic, researchMode, topicProfile, chair, memberOne, memberTwo, skeptic, topicEvidence, paymentEvidence, stats, paymentRail: PAYMENT_RAIL },
    fallback
  );

  return {
    mode: 'llm-parliament',
    executiveSummary: synthesizer.executiveSummary || fallback.executiveSummary,
    researchQuestion: topic,
    methodology: `AI Parliament workflow over topic evidence plus a separate x402/Stacks payment-rail evidence layer. Chair agenda: ${safeArray(chair.agenda, []).join('; ')}`,
    keyFindings: safeArray(synthesizer.keyFindings, fallback.keyFindings || []),
    implications: safeArray(synthesizer.implications, fallback.implications || []),
    limitations: safeArray(synthesizer.limitations, fallback.limitations || []),
    noveltyAssessment: synthesizer.noveltyAssessment || fallback.noveltyAssessment,
    consensus: synthesizer.consensus || fallback.consensus,
    nextResearchActions: safeArray(synthesizer.nextResearchActions, fallback.nextResearchActions || []),
    scenarios: safeArray(synthesizer.scenarios, fallback.scenarios || []),
    timeline: safeArray(synthesizer.timeline, fallback.timeline || []),
    domainSections: synthesizer.domainSections || fallback.domainSections || null,
    parliament: [
      { agent: topicProfile.specialistRoles[0].agent, role: topicProfile.specialistRoles[0].role, stance: chair.framing || 'No framing produced.' },
      { agent: topicProfile.specialistRoles[1].agent, role: topicProfile.specialistRoles[1].role, stance: memberOne.thesis || 'No thesis produced.' },
      { agent: topicProfile.specialistRoles[2].agent, role: topicProfile.specialistRoles[2].role, stance: memberTwo.thesis || 'No thesis produced.' },
      { agent: topicProfile.specialistRoles[3].agent, role: topicProfile.specialistRoles[3].role, stance: skeptic.caution || 'No caution produced.' }
    ],
    quality: {
      evidenceCoverage: evidenceBundle.topicEvidence.length,
      synthesisMode: researchMode === 'forecast' ? 'ai-parliament-forecast' : topicProfile.key === 'solidity' ? 'ai-parliament-security' : 'ai-parliament-general',
      confidence: stats['topic-core'] + stats['topic-framework'] >= 2 ? 'medium-high' : 'medium',
      evidenceStats: stats
    }
  };
}

async function generateReport(topic, researchMode, topicProfile, evidenceBundle) {
  if (!OPENAI_API_KEY) {
    return buildFallbackReport(topic, researchMode, topicProfile, evidenceBundle);
  }
  try {
    return await runAIParliament(topic, researchMode, topicProfile, evidenceBundle);
  } catch (error) {
    return {
      ...buildFallbackReport(topic, researchMode, topicProfile, evidenceBundle),
      error: error.message || 'unknown llm error'
    };
  }
}

function buildResearchReport(topic, researchMode, topicProfile, evidenceBundle, llmResult, extractedAssets) {
  return {
    title: `AutoScholar ${researchMode === 'forecast' ? 'forecast dossier' : 'research dossier'}: ${topic}`,
    researchMode,
    topicProfile,
    panelIdentities: topicProfile.specialistRoles.map((roleSpec) => buildAgentIdentity(roleSpec, topicProfile)),
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
    domainSections: llmResult.domainSections || null,
    parliament: safeArray(llmResult.parliament, []),
    evidenceTable: buildEvidenceTable(evidenceBundle.topicEvidence),
    paymentEvidenceTable: buildEvidenceTable(evidenceBundle.paymentEvidence),
    quality: llmResult.quality || { evidenceCoverage: evidenceBundle.topicEvidence.length, synthesisMode: 'unknown', confidence: 'unknown' },
    paymentRail: PAYMENT_RAIL,
    paymentFlow: buildPaymentFlow(),
    extractedAssets,
    citations: evidenceBundle.topicEvidence.map((paper, index) => ({
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
  res.json({ ok: true, service: 'autoscholar-backend', mode: 'v6.1-topic-agnostic' });
});

app.get('/api/config', (_req, res) => {
  res.json({
    apiBase: `http://localhost:${PORT}`,
    llmConfigured: Boolean(OPENAI_API_KEY),
    model: OPENAI_MODEL,
    providerBaseUrl: OPENAI_BASE_URL,
    paperSource: 'topic evidence + payment rail knowledge',
    paymentRail: PAYMENT_RAIL,
    orchestrationMode: 'topic-aware AI Parliament + x402/Stacks premium unlock',
    stacksIntegration: {
      network: STACKS_NETWORK,
      apiBase: STACKS_API_BASE,
      verification: 'txid-proof-scaffold'
    },
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
    const topicProfile = deriveTopicProfile(topic);
    const evidenceBundle = await retrieveEvidence(topic, researchMode, topicProfile);
    const id = makeId();
    const stacksPayment = buildStacksPaymentRequest({ jobId: id, amount: '0.5', asset: 'USDCx' });
    const x402Challenge = buildX402Challenge({ jobId: id, amount: '0.5', asset: 'USDCx', paymentRequest: stacksPayment });
    const job = {
      id,
      topic,
      searchQuery: evidenceBundle.query,
      researchMode,
      topicProfile,
      paperSource: 'topic evidence + payment rail knowledge',
      papers: evidenceBundle.topicEvidence,
      paymentEvidence: evidenceBundle.paymentEvidence,
      status: 'awaiting-payment',
      createdAt: new Date().toISOString(),
      orchestration: {
        manager: 'Manager Molbot',
        specialists: [...topicProfile.specialistRoles.map((r) => r.agent), 'Image Extractor Molbot'],
        identities: topicProfile.specialistRoles.map((r) => buildAgentIdentity(r, topicProfile)),
        meetingStatus: 'scheduled'
      },
      paymentRequest: {
        type: 'x402',
        asset: 'USDCx',
        amount: '0.5',
        recipient: stacksPayment.recipient,
        challenge: 'HTTP 402 Payment Required',
        specialist: 'Image Extractor Molbot',
        reason: 'Premium synthesis, AI Parliament debate, and extracted assets unlock after payment.',
        stacks: stacksPayment,
        x402: x402Challenge
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
  if (token !== DEMO_PAYMENT_TOKEN && !req.body?.txid) {
    const headers = buildX402Headers(job.paymentRequest.x402);
    Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
    return res.status(402).json({
      error: 'payment required',
      message: 'Provide a valid demo payment token or a Stacks transaction proof to unlock the AI Parliament report.',
      expectedHeader: 'x-payment-token',
      x402: job.paymentRequest.x402,
      stacks: job.paymentRequest.stacks
    });
  }

  try {
    let paymentReceipt;

    if (req.body?.txid) {
      const verification = await verifyStacksPayment({
        txid: req.body.txid,
        sender: req.body.sender,
        recipient: job.paymentRequest.stacks.recipient,
        amount: job.paymentRequest.amount,
        asset: job.paymentRequest.asset,
        memo: job.paymentRequest.stacks.memo
      });

      if (!verification.ok) {
        return res.status(402).json({
          error: 'payment verification failed',
          verification,
          x402: job.paymentRequest.x402,
          stacks: job.paymentRequest.stacks
        });
      }

      paymentReceipt = {
        asset: job.paymentRequest.asset,
        amount: job.paymentRequest.amount,
        txid: verification.txid,
        sender: verification.sender,
        recipient: verification.recipient,
        settlement: 'verified-stacks-payment',
        mode: verification.mode,
        chain: verification.chain,
        apiBase: verification.apiBase,
        memo: verification.memo
      };
    } else {
      paymentReceipt = {
        asset: 'USDCx',
        amount: '0.5',
        txid: 'demo-stacks-txid',
        settlement: 'mock-success',
        mode: 'simulated-chain-payment'
      };
    }

    const extractedAssets = [
      {
        id: 'asset_1',
        type: 'diagram',
        title: 'Research evidence flow + x402 premium unlock',
        description: 'Simulated diagram showing retrieval, debate, x402 challenge, Stacks settlement, and premium report release.'
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
      topicEvidence: job.papers || [],
      paymentEvidence: job.paymentEvidence || [],
      combined: [...(job.papers || []), ...(job.paymentEvidence || [])],
      query: job.searchQuery
    };

    const llmResult = await generateReport(job.topic, job.researchMode, job.topicProfile, evidenceBundle);
    const usedFallback = llmResult.mode === 'fallback';

    job.status = usedFallback ? 'completed_with_fallback' : 'completed';
    job.orchestration.meetingStatus = 'concluded';
    job.paidAt = new Date().toISOString();
    job.paymentReceipt = paymentReceipt;
    job.extractedAssets = extractedAssets;
    job.llm = {
      mode: llmResult.mode,
      model: OPENAI_MODEL,
      providerBaseUrl: OPENAI_BASE_URL,
      error: llmResult.error || null
    };
    job.report = buildResearchReport(job.topic, job.researchMode, job.topicProfile, evidenceBundle, llmResult, extractedAssets);

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
