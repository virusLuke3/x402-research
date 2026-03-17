import './env.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import {
  ALLOW_DEMO_PAYMENTS,
  buildStacksPaymentRequest,
  getStacksPaymentReadiness,
  isPaymentRequestExpired,
  verifyStacksPayment,
  STACKS_NETWORK,
  STACKS_API_BASE,
} from './stacks.js';
import { buildX402Challenge, buildX402Headers } from './x402.js';
import { buildClarityPaymentSpec, buildClarityVerificationPlan } from './clarity-payment.js';
import { readContractInvoiceState, seedContractInvoiceState, markContractInvoicePaid, markContractInvoiceConsumed } from './contract-state.js';
import { createRequestId, getLogPath, logError, logInfo, logWarn } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8787;
const DEFAULT_FRONTEND_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN || DEFAULT_FRONTEND_ORIGINS.join(','))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const FRONTEND_ORIGIN_PATTERNS = (process.env.FRONTEND_ORIGIN_PATTERNS || '')
  .split(',')
  .map((pattern) => pattern.trim())
  .filter(Boolean);
const DEMO_PAYMENT_TOKEN = process.env.DEMO_PAYMENT_TOKEN || 'demo-paid-token';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_API_STYLE = (process.env.OPENAI_API_STYLE || 'chat-completions').trim().toLowerCase();
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.4';
const RESEARCH_PYTHON_BIN = process.env.RESEARCH_PYTHON_BIN || process.env.PYTHON_BIN || 'python3';
const PAYMENT_AMOUNT = process.env.STACKS_PAYMENT_AMOUNT || '500000';

function matchesOriginPattern(origin, pattern) {
  const regex = new RegExp(`^${pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')}$`);
  return regex.test(origin);
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (FRONTEND_ORIGINS.includes(origin)) return true;
  return FRONTEND_ORIGIN_PATTERNS.some((pattern) => matchesOriginPattern(origin, pattern));
}

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  }
}));
app.use(express.json());
app.use((req, res, next) => {
  const requestId = createRequestId();
  const startedAt = Date.now();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  logInfo('http.request.start', {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  res.on('finish', () => {
    logInfo('http.request.finish', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });
  next();
});

app.get('/api/payment/readiness', async (_req, res) => {
  try {
    const readiness = await getStacksPaymentReadiness();
    if (!readiness.ok) {
      logWarn('payment.readiness.warning', readiness);
    }
    return res.json(readiness);
  } catch (error) {
    logError('payment.readiness.failed', { error });
    return res.status(500).json({ error: error.message || 'failed to inspect payment readiness' });
  }
});

const jobs = new Map();

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
    verificationMode: 'clarity-contract-path-scaffold',
    contractLanguage: 'Clarity'
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
  commerce: [
    {
      id: 'fw-commerce-001',
      title: 'Machine-to-machine commerce protocol design on x402 and Stacks',
      summary: 'A topic scaffold for agentic commerce covering challenge schemas, settlement rails, invoice lifecycle, entitlement release, replay protection, and specialist service pricing.',
      keywords: ['x402', 'stacks', 'agentic commerce', 'molbot', 'entitlement', 'invoice lifecycle'],
      sourceType: 'local-framework',
      category: 'topic-framework',
      published: '2026-03-12',
      authors: ['AutoScholar Topic Framework']
    },
    {
      id: 'fw-commerce-002',
      title: 'Pricing and settlement strategies for specialist molbot services',
      summary: 'Specialist agent markets should distinguish default rails, high-value rails, and stable-pricing rails. STX can serve as the native default, sBTC for Bitcoin-aligned premium value transfer, and USDCx for predictable service pricing.',
      keywords: ['USDCx', 'sBTC', 'STX', 'pricing rails', 'specialist service'],
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

function validatePaymentAuthorization(authorization, challenge) {
  if (!authorization || typeof authorization !== 'object') {
    return { ok: false, reason: 'missing authorization payload' };
  }
  const checks = [
    ['paymentId', challenge.paymentId],
    ['nonce', challenge.nonce],
    ['expiresAt', challenge.expiresAt],
    ['resource', challenge.resource || challenge.unlock?.resource],
  ];
  for (const [field, expected] of checks) {
    if (expected && authorization[field] !== expected) {
      return { ok: false, reason: `${field} mismatch` };
    }
  }
  if (challenge.maxAmountRequired && String(authorization.amount || '') !== String(challenge.maxAmountRequired)) {
    return { ok: false, reason: 'amount mismatch' };
  }
  return { ok: true };
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

  if (/(x402|stacks|molbot|agentic commerce|agent-to-agent|usdcx|sbtc|invoice|entitlement|capability unlock|challenge schema|payment rail)/i.test(text)) {
    return {
      key: 'commerce',
      label: 'Agentic Commerce Protocol Research',
      description: 'Protocol research for molbot-to-molbot commerce, payment rails, capability unlock semantics, and settlement design.',
      retrieverHint: 'x402 stacks agentic commerce molbot payment rail entitlement invoice lifecycle usdcx sbtc',
      specialistRoles: [
        { agent: 'Chair Agent', role: 'Debate chair' },
        { agent: 'Protocol Economist Agent', role: 'Pricing rails and market design analysis' },
        { agent: 'Settlement Architect Agent', role: 'Invoice lifecycle and payment verification analysis' },
        { agent: 'Skeptic Agent', role: 'Challenge weak protocol assumptions and overclaims' }
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
  const englishKeywords = safeArray(cleaned.match(/[a-z0-9-]+/ig), []).join(' ');
  const containsCjk = /[\u4e00-\u9fff]/.test(cleaned);

  if (containsCjk) {
    const hintQuery = [topicProfile.retrieverHint, englishKeywords].filter(Boolean).join(' ').trim();
    return hintQuery || topicProfile.retrieverHint;
  }

  if (topicProfile.key === 'solidity') {
    return [cleaned, topicProfile.retrieverHint].filter(Boolean).join(' ').trim();
  }
  if (researchMode === 'forecast') {
    return [cleaned, topicProfile.retrieverHint].filter(Boolean).join(' ').trim();
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

async function fetchArxivPapers(query, topic, topicProfile) {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=60&sortBy=relevance&sortOrder=descending`;
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
  return callResearchBridge('prepare', { topic });
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
    'Requester or upstream molbot submits a research task.',
    'Manager Molbot retrieves evidence, scopes the work, and prepares a specialist bundle.',
    'Backend returns an x402 challenge carrying the parent invoice and Stacks settlement details.',
    'Requester pays the parent invoice through the configured Stacks settlement path.',
    'Backend verifies settlement, releases paid specialist tasks, and packages human-readable plus machine-readable outputs.'
  ];
}

function formatAssetDisplay(asset, amount) {
  if (asset === 'STX') {
    const value = Number(amount || 0) / 1_000_000;
    return `${value.toFixed(6).replace(/\.?0+$/, '')} STX`;
  }
  return `${amount} ${asset}`;
}

function distributeQuotedAmounts(totalAmount, count) {
  const total = Number.parseInt(String(totalAmount || 0), 10);
  if (!Number.isFinite(total) || total <= 0 || count <= 0) {
    return Array.from({ length: Math.max(count, 0) }, () => 0);
  }
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_value, index) => (index < remainder ? base + 1 : base));
}

function buildServiceManifest(job) {
  const asset = job?.paymentRequest?.asset || 'STX';
  const amount = job?.paymentRequest?.amount || '0';
  const displayAmount = formatAssetDisplay(asset, amount);
  const status = job?.paymentReceipt ? 'ready' : job?.status === 'processing' ? 'preparing' : 'quoted';

  return [
    {
      id: 'research-dossier',
      title: 'Research Dossier',
      format: 'markdown',
      audience: 'human + agent',
      status,
      price: displayAmount,
      settlement: 'bundled-under-parent-invoice',
      description: 'Long-form premium dossier with synthesis, implications, and implementation guidance.'
    },
    {
      id: 'evidence-pack',
      title: 'Evidence Pack',
      format: 'json',
      audience: 'agent',
      status,
      price: displayAmount,
      settlement: 'bundled-under-parent-invoice',
      description: 'Machine-readable evidence shortlist for downstream molbots.'
    },
    {
      id: 'citation-ledger',
      title: 'Citation Ledger',
      format: 'json',
      audience: 'agent',
      status,
      price: displayAmount,
      settlement: 'bundled-under-parent-invoice',
      description: 'Structured citation and payment-rail reference bundle.'
    },
    {
      id: 'agent-handoff',
      title: 'Agent Handoff Packet',
      format: 'json',
      audience: 'agent',
      status,
      price: displayAmount,
      settlement: 'bundled-under-parent-invoice',
      description: 'Compact task outcome packet for other agents to continue work without re-running retrieval.'
    }
  ];
}

function buildTaskTree(job, stage = 'quote-issued', llmResult = null, extractedAssets = []) {
  const asset = job?.paymentRequest?.asset || 'STX';
  const amount = job?.paymentRequest?.amount || '0';
  const specialists = safeArray(job?.topicProfile?.specialistRoles, []);
  const bundledCount = specialists.length + 3;
  const quotes = distributeQuotedAmounts(amount, bundledCount);
  let quoteIndex = 0;

  const nextQuote = () => {
    const quotedAmount = quotes[quoteIndex] || 0;
    quoteIndex += 1;
    return {
      amount: String(quotedAmount),
      asset,
      displayAmount: formatAssetDisplay(asset, quotedAmount),
      settlement: 'bundled-under-parent-invoice'
    };
  };

  const statuses = {
    'quote-issued': {
      root: 'awaiting-payment',
      evidence: 'completed',
      gateway: 'awaiting-payment',
      specialist: 'locked',
      packaging: 'locked'
    },
    processing: {
      root: 'processing',
      evidence: 'completed',
      gateway: 'paid',
      specialist: 'processing',
      packaging: 'processing'
    },
    completed: {
      root: 'completed',
      evidence: 'completed',
      gateway: 'paid',
      specialist: 'completed',
      packaging: 'completed'
    },
    'completed-with-fallback': {
      root: 'completed_with_fallback',
      evidence: 'completed',
      gateway: 'paid',
      specialist: 'completed',
      packaging: 'completed_with_fallback'
    }
  }[stage] || {
    root: 'awaiting-payment',
    evidence: 'completed',
    gateway: 'awaiting-payment',
    specialist: 'locked',
    packaging: 'locked'
  };

  const parliamentByAgent = new Map(
    safeArray(llmResult?.parliament, []).map((item) => [item.agent, item])
  );

  const nodes = [
    {
      id: 'manager-router',
      parentId: null,
      depth: 0,
      label: 'Manager Router',
      agent: 'Manager Molbot',
      role: 'Scope the task, prepare the quote, and orchestrate specialist work.',
      status: statuses.root,
      pricing: null,
      unlockCondition: 'always-on',
      resultSummary: 'Creates the parent invoice and chooses which paid specialist services to unlock.'
    },
    {
      id: 'evidence-scout',
      parentId: 'manager-router',
      depth: 1,
      label: 'Evidence Scout',
      agent: 'Evidence Scout Molbot',
      role: 'Retrieval across topic evidence and payment-rail references.',
      status: statuses.evidence,
      pricing: null,
      unlockCondition: 'free pre-quote preparation',
      resultSummary: `${safeArray(job?.papers, []).length} evidence sources prepared before payment.`
    },
    {
      id: 'x402-gateway',
      parentId: 'manager-router',
      depth: 1,
      label: 'x402 Gateway',
      agent: 'x402 Settlement Gateway',
      role: 'Issue parent invoice, bind authorization, and release specialist capabilities after verified payment.',
      status: statuses.gateway,
      pricing: {
        amount: String(amount),
        asset,
        displayAmount: formatAssetDisplay(asset, amount),
        settlement: 'parent-invoice'
      },
      unlockCondition: 'requires verified parent invoice',
      resultSummary: job?.paymentReceipt
        ? `Verified settlement ${job.paymentReceipt.txid || ''}`.trim()
        : 'Specialist services remain locked until payment is verified.'
    }
  ];

  const specialistNodes = specialists.map((roleSpec, index) => {
    const panelSummary = parliamentByAgent.get(roleSpec.agent)?.stance || `Unlock ${roleSpec.role.toLowerCase()} after settlement.`;
    return {
      id: `panel-${index + 1}`,
      parentId: 'x402-gateway',
      depth: 2,
      label: roleSpec.agent,
      agent: roleSpec.agent,
      role: roleSpec.role,
      status: statuses.specialist,
      pricing: nextQuote(),
      unlockCondition: 'released after parent invoice payment',
      resultSummary: truncate(panelSummary, 180)
    };
  });

  nodes.push(
    ...specialistNodes,
    {
      id: 'citation-auditor',
      parentId: 'x402-gateway',
      depth: 2,
      label: 'Citation Auditor',
      agent: 'Citation Auditor Molbot',
      role: 'Normalize references into an agent-consumable citation ledger.',
      status: statuses.specialist,
      pricing: nextQuote(),
      unlockCondition: 'released after parent invoice payment',
      resultSummary: llmResult
        ? `${safeArray(job?.report?.citations, []).length || safeArray(job?.papers, []).length} citations prepared for downstream agents.`
        : 'Will produce a machine-readable citation ledger after payment.'
    },
    {
      id: 'figure-extractor',
      parentId: 'x402-gateway',
      depth: 2,
      label: 'Figure Extractor',
      agent: 'Figure Extractor Molbot',
      role: 'Package diagram, chart, and supporting visual asset metadata.',
      status: statuses.specialist,
      pricing: nextQuote(),
      unlockCondition: 'released after parent invoice payment',
      resultSummary: extractedAssets?.length
        ? `${extractedAssets.length} premium asset records prepared.`
        : 'Reserved slot for premium visual assets and structured attachments.'
    },
    {
      id: 'deliverable-packer',
      parentId: 'x402-gateway',
      depth: 3,
      label: 'Deliverable Packer',
      agent: 'Delivery Packager Molbot',
      role: 'Bundle markdown dossier, evidence pack, and agent handoff packet.',
      status: statuses.packaging,
      pricing: nextQuote(),
      unlockCondition: 'runs after specialist outputs are released',
      resultSummary: llmResult
        ? 'Packages markdown + JSON outputs for both humans and downstream molbots.'
        : 'Queued until settlement and specialist execution complete.'
    }
  );

  const edges = nodes
    .filter((node) => node.parentId)
    .map((node) => ({ from: node.parentId, to: node.id }));

  const statusCounts = nodes.reduce((accumulator, node) => {
    accumulator[node.status] = (accumulator[node.status] || 0) + 1;
    return accumulator;
  }, {});

  return {
    rootId: 'manager-router',
    stage,
    summary: {
      totalNodes: nodes.length,
      specialistNodes: specialistNodes.length + 3,
      paidNodes: nodes.filter((node) => node.pricing?.amount && Number(node.pricing.amount) > 0).length,
      statusCounts
    },
    nodes,
    edges
  };
}

function buildCommerceTrace(job, stage = 'quote-issued', llmResult = null, extractedAssets = []) {
  const asset = job?.paymentRequest?.asset || 'STX';
  const amount = job?.paymentRequest?.amount || '0';
  const displayAmount = formatAssetDisplay(asset, amount);
  const events = [
    {
      id: 'trace-intake',
      title: 'Task scoped by manager molbot',
      detail: `Topic received and profiled as ${job?.topicProfile?.label || 'general research'}.`,
      actor: 'Manager Molbot',
      category: 'planning',
      status: 'completed',
      timestamp: job?.createdAt
    },
    {
      id: 'trace-evidence',
      title: 'Evidence pack prepared before payment',
      detail: `${safeArray(job?.papers, []).length} topic evidence items prepared for premium routing.`,
      actor: 'Evidence Scout Molbot',
      category: 'retrieval',
      status: 'completed',
      timestamp: job?.createdAt
    },
    {
      id: 'trace-quote',
      title: 'x402 parent invoice issued',
      detail: `Parent invoice ${job?.paymentRequest?.x402?.paymentId || 'pending'} quotes ${displayAmount} for the specialist bundle.`,
      actor: 'x402 Settlement Gateway',
      category: 'quote',
      status: stage === 'quote-issued' ? 'awaiting-payment' : 'completed',
      timestamp: job?.createdAt,
      amountDisplay: displayAmount
    }
  ];

  if (stage !== 'quote-issued') {
    events.push(
      {
        id: 'trace-payment',
        title: 'Stacks payment verified',
        detail: `Settlement verified against ${job?.paymentReceipt?.verificationTarget || 'Stacks payment path'}.`,
        actor: 'Verification Backend',
        category: 'settlement',
        status: 'completed',
        timestamp: job?.paidAt || new Date().toISOString(),
        amountDisplay: displayAmount,
        txid: job?.paymentReceipt?.txid || null
      },
      {
        id: 'trace-release',
        title: 'Paid specialist capabilities released',
        detail: `Unlocked ${safeArray(job?.topicProfile?.specialistRoles, []).length + 3} paid subtasks under the parent invoice.`,
        actor: 'Manager Molbot',
        category: 'execution',
        status: stage === 'processing' ? 'processing' : 'completed',
        timestamp: job?.paidAt || new Date().toISOString()
      }
    );
  }

  if (stage === 'completed' || stage === 'completed-with-fallback') {
    events.push(
      {
        id: 'trace-synthesis',
        title: stage === 'completed-with-fallback' ? 'Fallback synthesis used' : 'Premium synthesis concluded',
        detail: stage === 'completed-with-fallback'
          ? 'The payment path succeeded, and delivery completed using a degraded synthesis fallback.'
          : llmResult?.executiveSummary || 'Specialist synthesis completed and merged into the final dossier.',
        actor: 'Delivery Packager Molbot',
        category: 'synthesis',
        status: stage === 'completed-with-fallback' ? 'completed_with_fallback' : 'completed',
        timestamp: job?.paidAt || new Date().toISOString()
      },
      {
        id: 'trace-delivery',
        title: 'Human + machine deliverables packaged',
        detail: `${extractedAssets.length} asset records plus markdown and JSON handoff outputs are ready.`,
        actor: 'Agent Handoff Packager',
        category: 'delivery',
        status: stage === 'completed-with-fallback' ? 'completed_with_fallback' : 'completed',
        timestamp: job?.paidAt || new Date().toISOString()
      }
    );
  }

  return {
    stage,
    summary: {
      totalEvents: events.length,
      paymentVerified: Boolean(job?.paymentReceipt),
      txid: job?.paymentReceipt?.txid || null
    },
    events
  };
}

function buildOutputManifest(job, evidenceBundle = null, report = null, taskTree = null, commerceTrace = null) {
  const lockedStatus = job?.status === 'processing' ? 'preparing' : 'locked';

  if (!report) {
    return {
      status: lockedStatus,
      items: [
        {
          id: 'research-dossier',
          title: 'Research Dossier',
          format: 'markdown',
          audience: 'human + agent',
          status: lockedStatus,
          description: 'Premium markdown dossier unlocks after the parent invoice is paid.'
        },
        {
          id: 'evidence-pack',
          title: 'Evidence Pack',
          format: 'json',
          audience: 'agent',
          status: lockedStatus,
          description: 'Structured evidence shortlist for downstream agents.'
        },
        {
          id: 'agent-handoff',
          title: 'Agent Handoff Packet',
          format: 'json',
          audience: 'agent',
          status: lockedStatus,
          description: 'Machine-readable summary of what was done, what was paid for, and what should happen next.'
        }
      ]
    };
  }

  const researchBrief = {
    title: report.title,
    topic: job.topic,
    researchMode: job.researchMode,
    executiveSummary: report.executiveSummary,
    keyFindings: report.keyFindings,
    implications: report.implications,
    consensus: report.consensus,
    nextResearchActions: report.nextResearchActions,
    quality: report.quality
  };

  const evidencePack = {
    query: evidenceBundle?.query || job.searchQuery,
    topicEvidence: report.evidenceTable,
    paymentEvidence: report.paymentEvidenceTable,
    extractedAssets: report.extractedAssets
  };

  const citationLedger = {
    citations: report.citations,
    paymentCitations: report.paymentCitations
  };

  const agentHandoff = {
    topic: job.topic,
    payment: {
      paymentId: job?.paymentRequest?.x402?.paymentId || null,
      asset: job?.paymentRequest?.asset || null,
      amount: job?.paymentRequest?.amount || null,
      txid: job?.paymentReceipt?.txid || null,
      verificationMode: job?.paymentReceipt?.mode || null
    },
    deliverables: safeArray(job?.serviceManifest, []).map((service) => ({
      id: service.id,
      title: service.title,
      format: service.format,
      audience: service.audience
    })),
    taskTreeDigest: safeArray(taskTree?.nodes, []).map((node) => ({
      id: node.id,
      label: node.label,
      agent: node.agent,
      status: node.status,
      price: node.pricing?.displayAmount || 'bundled'
    })),
    traceDigest: safeArray(commerceTrace?.events, []).map((event) => ({
      id: event.id,
      title: event.title,
      category: event.category,
      status: event.status
    }))
  };

  return {
    status: 'ready',
    items: [
      {
        id: 'research-dossier',
        title: 'Research Dossier',
        format: 'markdown',
        audience: 'human + agent',
        status: 'ready',
        description: 'Primary long-form deliverable.',
        preview: report.markdown
      },
      {
        id: 'research-brief',
        title: 'Research Brief',
        format: 'json',
        audience: 'agent',
        status: 'ready',
        description: 'Compact thesis and recommendation packet.',
        payload: researchBrief
      },
      {
        id: 'evidence-pack',
        title: 'Evidence Pack',
        format: 'json',
        audience: 'agent',
        status: 'ready',
        description: 'Evidence shortlist and premium asset inventory.',
        payload: evidencePack
      },
      {
        id: 'citation-ledger',
        title: 'Citation Ledger',
        format: 'json',
        audience: 'agent',
        status: 'ready',
        description: 'Structured citations ready for downstream use.',
        payload: citationLedger
      },
      {
        id: 'agent-handoff',
        title: 'Agent Handoff Packet',
        format: 'json',
        audience: 'agent',
        status: 'ready',
        description: 'Task, payment, and execution digest for downstream molbots.',
        payload: agentHandoff
      }
    ]
  };
}

function buildCitationUrl(item) {
  const id = String(item?.id || '').trim();
  if (/^https?:\/\//i.test(id)) {
    return id.replace(/^http:\/\//i, 'https://');
  }
  return null;
}

function buildCitationRecords(items, prefix = '') {
  return items.map((paper, index) => ({
    ref: `[${prefix}${index + 1}]`,
    title: paper.title,
    authors: paper.authors,
    published: formatDate(paper.published),
    sourceType: paper.sourceType,
    evidenceClass: paper.evidenceClass,
    id: paper.id,
    url: buildCitationUrl(paper),
    summary: truncate(paper.summary, 320)
  }));
}

function buildMarkdownReferenceLine(citation, index) {
  const authorText = safeArray(citation.authors, []).join(', ') || 'Unknown authors';
  const tail = [authorText, citation.published, citation.sourceType].filter(Boolean).join(' · ');
  if (citation.url) {
    return `${index + 1}. ${citation.ref} [${citation.title}](${citation.url})${tail ? ` — ${tail}` : ''}`;
  }
  return `${index + 1}. ${citation.ref} ${citation.title}${tail ? ` — ${tail}` : ''}。无公开链接。`;
}

async function buildReportPlan(topic, researchMode, topicProfile, evidenceBundle, llmResult, topicCitations) {
  const fallbackPlan = {
    sections: [
      { id: 'summary', title: '执行摘要', goal: '概括主题、核心结论与证据边界。', evidenceRefs: ['[1]', '[2]'] },
      { id: 'method', title: '研究范围与方法', goal: '说明资料来源、筛选范围、综合方法。', evidenceRefs: ['[1]'] },
      { id: 'core', title: '核心文献解析', goal: '优先解析最重要的 3-5 条证据及其局限。', evidenceRefs: ['[1]', '[2]', '[3]'] },
      { id: 'review', title: '技术综述 / 现状分析', goal: '整合共识、差异、成熟度与现实意义。', evidenceRefs: ['[1]', '[2]', '[3]', '[4]'] },
      { id: 'advice', title: '综合判断与实施建议', goal: '给出面向项目落地的建议。', evidenceRefs: ['[1]', '[2]'] },
      { id: 'limits', title: '风险与局限', goal: '明确证据边界、争议与不足。', evidenceRefs: ['[1]'] },
      { id: 'future', title: '后续研究方向', goal: '指出下一步应补的证据与工作。', evidenceRefs: ['[1]'] },
      { id: 'refs', title: '参考文献', goal: '列出所用证据。', evidenceRefs: ['[1]', '[2]', '[3]', '[4]', '[5]'] }
    ]
  };

  try {
    const content = await callLLM([
      {
        role: 'system',
        content: '你是一名学术综述写作规划师。请先为最终报告制定章节计划。严格输出 JSON，包含 sections 数组；每个 section 包含 id、title、goal、evidenceRefs。不要写正文。'
      },
      {
        role: 'user',
        content: JSON.stringify({
          topic,
          researchMode,
          topicProfile,
          executiveSummary: llmResult.executiveSummary,
          keyFindings: llmResult.keyFindings,
          consensus: llmResult.consensus,
          limitations: llmResult.limitations,
          citations: topicCitations.slice(0, 5)
        })
      }
    ], 0.1);
    const parsed = parseJSONContent(content);
    return parsed?.sections?.length ? parsed : fallbackPlan;
  } catch {
    return fallbackPlan;
  }
}

async function reviewReportPlan(topic, llmResult, plan, evidenceBundle) {
  const fallbackReview = {
    risks: [
      'Avoid repeating abstracts paper by paper without synthesis.',
      'Do not overclaim evidence strength if the topic evidence is sparse.',
      'Keep x402 / Stacks as infrastructure unless the topic is directly about them.'
    ],
    mustInclude: ['evidence strength', 'limitations', 'implementation guidance']
  };

  try {
    const content = await callLLM([
      {
        role: 'system',
        content: '你是一名严格的学术审稿人。请检查报告计划可能存在的过度结论、缺失部分和证据边界问题。严格输出 JSON，包含 risks 和 mustInclude。'
      },
      {
        role: 'user',
        content: JSON.stringify({
          topic,
          plan,
          keyFindings: llmResult.keyFindings,
          limitations: llmResult.limitations,
          evidenceStats: buildEvidenceStats(evidenceBundle.topicEvidence)
        })
      }
    ], 0.1);
    const parsed = parseJSONContent(content);
    return parsed?.risks?.length ? parsed : fallbackReview;
  } catch {
    return fallbackReview;
  }
}

function buildFallbackMarkdownReport(topic, researchMode, topicProfile, evidenceBundle, llmResult, topicCitations) {
  const title = `# AutoScholar ${researchMode === 'forecast' ? '预测研究报告' : '研究报告'}：${topic}`;
  const evidenceRows = safeArray(evidenceBundle.topicEvidence, []).map((paper, index) => {
    const citation = topicCitations[index];
    const prefix = citation?.url ? `- **[${paper.title}](${citation.url})**` : `- **${paper.title}**`;
    const meta = [formatDate(paper.published), safeArray(paper.authors, []).join(', '), paper.sourceType, paper.evidenceClass].filter(Boolean).join(' · ');
    return `${prefix}${meta ? ` — ${meta}` : ''}\n  - ${truncate(paper.summary, 520)}`;
  });
  const evidenceHighlights = safeArray(evidenceBundle.topicEvidence, []).slice(0, 5).map((paper, index) => {
    const citation = topicCitations[index];
    const titleLine = citation?.url ? `### ${index + 1}. [${paper.title}](${citation.url})` : `### ${index + 1}. ${paper.title}`;
    return [
      titleLine,
      `- **作者 / 时间**：${[safeArray(paper.authors, []).join(', '), formatDate(paper.published)].filter(Boolean).join(' · ') || '未提供'}`,
      `- **证据类型**：${paper.sourceType || 'unknown'} / ${paper.evidenceClass || 'unknown'}`,
      `- **为什么重要**：${truncate(paper.summary, 380)}`,
      `- **对本主题的启发**：${truncate((safeArray(llmResult.keyFindings, [])[index % Math.max(safeArray(llmResult.keyFindings, []).length, 1)] || llmResult.consensus || '该证据为当前主题提供了可直接借鉴的分析线索。'), 220)}`,
      ''
    ].join('\n');
  });
  const sections = [
    title,
    '',
    '## 1. 执行摘要',
    llmResult.executiveSummary || `围绕“${topic}”的当前证据已完成初步综合。`,
    '',
    '## 2. 研究范围与方法',
    llmResult.methodology || `基于 ${topicProfile.label} 的主题证据检索、筛选和综合分析。`,
    '',
    '## 3. 核心文献解析',
    ...(evidenceHighlights.length ? evidenceHighlights : ['当前尚缺少足够高质量证据用于展开逐篇解析。']),
    '## 4. 核心发现',
    ...safeArray(llmResult.keyFindings, []).map((item) => `- ${item}`),
    '',
    '## 5. 技术综述 / 现状分析',
    llmResult.consensus || '当前证据已支持形成初步综合判断，但仍需结合更多高质量外部论文继续扩展。',
    ''
  ];

  if (llmResult.domainSections?.vulnerabilityTaxonomy?.length) {
    sections.push('## 5. 漏洞类别与缓解模式');
    sections.push('### 5.1 漏洞类别');
    sections.push(...safeArray(llmResult.domainSections.vulnerabilityTaxonomy, []).map((item) => `- ${item}`));
    sections.push('');
    if (safeArray(llmResult.domainSections.mitigationPatterns, []).length) {
      sections.push('### 5.2 缓解模式');
      sections.push(...safeArray(llmResult.domainSections.mitigationPatterns, []).map((item) => `- ${item}`));
      sections.push('');
    }
  }

  if (safeArray(llmResult.scenarios, []).length) {
    sections.push('## 5. 情景分析');
    sections.push(...safeArray(llmResult.scenarios, []).map((item) => `- **${item.name}**（${item.probability}）：${item.outlook} 驱动因素：${item.driver}`));
    sections.push('');
  }

  if (safeArray(llmResult.timeline, []).length) {
    sections.push('## 6. 时间线判断');
    sections.push(...safeArray(llmResult.timeline, []).map((item) => `- **${item.window}**：${item.expectation}`));
    sections.push('');
  }

  if (safeArray(llmResult.implications, []).length) {
    sections.push('## 7. 启示与建议');
    sections.push(...safeArray(llmResult.implications, []).map((item) => `- ${item}`));
    sections.push('');
  }

  if (evidenceRows.length) {
    sections.push('## 9. 证据综述');
    sections.push(...evidenceRows);
    sections.push('');
  }

  if (safeArray(llmResult.limitations, []).length) {
    sections.push('## 10. 局限性');
    sections.push(...safeArray(llmResult.limitations, []).map((item) => `- ${item}`));
    sections.push('');
  }

  if (safeArray(llmResult.nextResearchActions, []).length) {
    sections.push('## 11. 后续研究方向');
    sections.push(...safeArray(llmResult.nextResearchActions, []).map((item) => `- ${item}`));
    sections.push('');
  }

  sections.push('## 12. 参考文献');
  if (topicCitations.length) {
    sections.push(...topicCitations.map((citation, index) => buildMarkdownReferenceLine(citation, index)));
  } else {
    sections.push('当前没有可公开跳转的外部参考文献链接。');
  }

  return sections.join('\n');
}

async function generateAcademicMarkdownReport(topic, researchMode, topicProfile, evidenceBundle, llmResult, topicCitations) {
  if (!OPENAI_API_KEY) {
    return buildFallbackMarkdownReport(topic, researchMode, topicProfile, evidenceBundle, llmResult, topicCitations);
  }

  const curatedTopicEvidence = evidenceBundle.topicEvidence.filter((paper) => ['topic-core', 'topic-framework', 'payment-rail'].includes(paper.evidenceClass)).slice(0, 6);
  const evidenceForPrompt = curatedTopicEvidence.map((paper, index) => ({
    rank: index + 1,
    title: paper.title,
    authors: paper.authors,
    published: formatDate(paper.published),
    sourceType: paper.sourceType,
    evidenceClass: paper.evidenceClass,
    category: paper.category,
    relevanceScore: paper.relevanceScore,
    url: buildCitationUrl(paper),
    abstract: truncate(paper.summary, 1200)
  }));
  const evidenceStats = buildEvidenceStats(evidenceBundle.topicEvidence);
  const parliamentSummary = safeArray(llmResult.parliament, []).map((item, index) => ({
    rank: index + 1,
    agent: item.agent,
    role: item.role,
    stance: item.stance
  }));
  const plan = await buildReportPlan(topic, researchMode, topicProfile, evidenceBundle, llmResult, topicCitations);
  const review = await reviewReportPlan(topic, llmResult, plan, evidenceBundle);

  const systemPrompt = [
    '你是一位资深学术文献综述撰写专家。',
    '你的任务是把研究证据、AI Parliament 讨论结果、章节计划与审稿意见整合为一篇成熟、完整、逻辑严密、可直接阅读的 Markdown 研究报告。',
    '写作风格参考 Full-Workflow Multi-Agent Literature Review：先规划，再审查，再写作。',
    '必须使用严谨中文，避免空话、营销语、模板化套话。',
    '严禁虚构未提供的论文数量、实验结果、引用关系或链上实现细节。',
    '报告必须体现：证据强弱、共识与分歧、研究边界、下一步建议。',
    '直接输出 Markdown，不要输出 JSON，不要输出代码块包裹的 Markdown。'
  ].join(' ');

  const userPrompt = [
    `研究主题：${topic}`,
    `研究模式：${researchMode}`,
    `主题领域：${topicProfile.label}`,
    '',
    '最终写作要求：',
    '- 严格按照“先章节规划、后吸收审稿意见、再写正文”的方式组织内容。',
    '- 报告至少包含这些部分：执行摘要、研究范围与方法、核心文献解析、技术综述/现状分析、综合判断与实施建议、风险与局限、后续研究方向、参考文献。',
    '- 核心文献解析必须优先解析 3-5 条最重要证据，并说明价值与局限。',
    '- 技术综述部分必须综合证据，不要把摘要逐条复述。',
    '- 必须吸收 review 中的风险提醒和 mustInclude 项。',
    '- 参考文献部分必须引用下面提供的证据；若存在 url，则用 Markdown 链接。',
    '- 如果主题与 x402/Stacks 无直接学术关系，只能将其简要说明为支付/解锁基础设施，不要喧宾夺主。',
    '',
    'AI Parliament 综合结果：',
    JSON.stringify({
      executiveSummary: llmResult.executiveSummary,
      researchQuestion: llmResult.researchQuestion,
      methodology: llmResult.methodology,
      keyFindings: llmResult.keyFindings,
      implications: llmResult.implications,
      limitations: llmResult.limitations,
      noveltyAssessment: llmResult.noveltyAssessment,
      consensus: llmResult.consensus,
      nextResearchActions: llmResult.nextResearchActions,
      scenarios: llmResult.scenarios,
      timeline: llmResult.timeline,
      domainSections: llmResult.domainSections,
      parliament: parliamentSummary,
      quality: llmResult.quality
    }, null, 2),
    '',
    '章节计划：',
    JSON.stringify(plan, null, 2),
    '',
    '审稿意见：',
    JSON.stringify(review, null, 2),
    '',
    '证据统计：',
    JSON.stringify(evidenceStats, null, 2),
    '',
    '可用主题证据：',
    JSON.stringify(evidenceForPrompt, null, 2),
    '',
    '参考文献元数据：',
    JSON.stringify(topicCitations, null, 2)
  ].join('\n');

  try {
    const content = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], 0.2);

    if (typeof content === 'string' && content.trim()) {
      return content.trim();
    }
  } catch {
  }

  return buildFallbackMarkdownReport(topic, researchMode, topicProfile, evidenceBundle, llmResult, topicCitations);
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

function extractLlmText(payload) {
  if (!payload || typeof payload !== 'object') return '';
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }
  if (Array.isArray(payload.output)) {
    for (const item of payload.output) {
      const content = Array.isArray(item?.content) ? item.content : [];
      for (const entry of content) {
        if (typeof entry?.text === 'string' && entry.text.trim()) {
          return entry.text;
        }
      }
    }
  }
  return payload?.choices?.[0]?.message?.content ?? payload?.choices?.[0]?.content ?? payload?.choices?.[0]?.text ?? '';
}

async function callLLM(messages, temperature = 0.1) {
  logInfo('llm.call.start', {
    model: OPENAI_MODEL,
    providerBaseUrl: OPENAI_BASE_URL,
    providerApiStyle: OPENAI_API_STYLE,
    messageCount: Array.isArray(messages) ? messages.length : 0,
    temperature,
  });
  const rawText = await new Promise((resolve, reject) => {
    const child = spawn(RESEARCH_PYTHON_BIN, [path.resolve(__dirname, './llm_tuzi.py')], {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeoutMs = Number(process.env.LLM_TIMEOUT_MS || 60000);

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new Error(`llm timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        logError('llm.call.process_failed', { code, stdout, stderr });
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
    logError('llm.call.invalid_json_envelope', { rawText });
    throw new Error(`LLM returned non-JSON envelope: ${rawText}`);
  }
  if (parsed?.code !== undefined) {
    if (parsed.code !== 0) {
      logError('llm.call.non_zero_code', parsed);
      throw new Error(parsed.message || JSON.stringify(parsed));
    }
    parsed = parsed.data || {};
  }
  if (parsed?.http_status || parsed?.error) {
    logError('llm.call.provider_error', parsed);
    throw new Error(parsed.error || `HTTP ${parsed.http_status}`);
  }
  logInfo('llm.call.success', {
    model: OPENAI_MODEL,
    providerBaseUrl: OPENAI_BASE_URL,
    providerApiStyle: OPENAI_API_STYLE,
  });
  return extractLlmText(parsed);
}

async function callResearchBridge(action, payload) {
  logInfo('research.bridge.start', {
    action,
    topic: payload?.topic || null,
    researchMode: payload?.researchMode || null,
  });
  const rawText = await new Promise((resolve, reject) => {
    const child = spawn(RESEARCH_PYTHON_BIN, [path.resolve(__dirname, './research_bridge.py')], {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeoutMs = Number(process.env.RESEARCH_TIMEOUT_MS || 300000);

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new Error(`research bridge timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        logError('research.bridge.process_failed', { action, code, stdout, stderr });
        reject(new Error(stdout || stderr || `research bridge exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });
    child.stdin.write(JSON.stringify({ action, ...payload }));
    child.stdin.end();
  });

  try {
    const parsed = JSON.parse(rawText);
    logInfo('research.bridge.success', {
      action,
      mode: parsed?.mode || null,
      evidenceCount: parsed?.topicEvidence?.length || parsed?.citations?.length || null,
    });
    return parsed;
  } catch {
    logError('research.bridge.invalid_json', { action, rawText });
    throw new Error(`research bridge returned invalid JSON: ${rawText}`);
  }
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

  if (topicProfile.key === 'commerce') {
    return {
      mode: 'fallback',
      executiveSummary: `Current evidence suggests a credible molbot-commerce protocol on x402 + Stacks should separate pricing envelopes, invoice-state transitions, and post-payment entitlements. The most defensible near-term design is not a fully autonomous open market, but a specialist-service network where manager molbots route demand to paid agents and unlock outputs after verifiable settlement.`,
      researchQuestion: topic,
      methodology: 'Topic-specific commerce retrieval plus deterministic protocol synthesis fallback.',
      keyFindings: [
        'x402 is best treated as a machine-readable challenge and entitlement layer, not only a paywall response code.',
        'Stacks settlement semantics become more legible when modeled as created → paid → consumed invoice state transitions.',
        'STX, sBTC, and USDCx should be positioned as different pricing rails rather than interchangeable assets with identical product roles.',
        'Specialist molbot networks are more realistic near-term than unrestricted autonomous agent markets.'
      ],
      implications: [
        'The demo should emphasize challenge schema, invoice schema, and entitlement schema as first-class protocol objects.',
        'Security, shopping, and content molbots can share the same payment and capability-release primitives while pricing differently by rail.'
      ],
      limitations: [
        'External literature on molbot-to-molbot commerce remains sparse, so part of the current synthesis is protocol design reasoning rather than mature field consensus.',
        'More domain-specific sources are still needed beyond the local commerce framework and payment rail knowledge base.'
      ],
      noveltyAssessment: 'High as a protocol and product framing, with medium evidence maturity at the current retrieval depth.',
      consensus: 'A strong molbot-commerce protocol should keep service pricing, settlement verification, and capability redemption explicitly separated while allowing the same unlock primitives to support different agent specializations.',
      nextResearchActions: [
        'Add protocol-specific retrievers for machine-payable API access, capability tokens, and invoice replay protection.',
        'Introduce section-by-section protocol writing for challenge schema, lifecycle semantics, and rail selection tradeoffs.',
        'Bind each entitlement claim to evidence rows in the final dossier.'
      ],
      quality: {
        evidenceCoverage: evidenceBundle.topicEvidence.length,
        synthesisMode: 'commerce-fallback',
        confidence: stats['topic-core'] + stats['topic-framework'] + stats['payment-rail'] >= 3 ? 'medium' : 'low',
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
  return callResearchBridge('report', { topic, researchMode, topicProfile, evidenceBundle });
}

function buildResearchReport(topic, researchMode, topicProfile, evidenceBundle, llmResult, extractedAssets, contractState = null, extras = {}) {
  const citations = buildCitationRecords(evidenceBundle.topicEvidence);
  const paymentCitations = buildCitationRecords(evidenceBundle.paymentEvidence, 'P');

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
    paymentContract: {
      contractPrincipal: contractState?.contractPrincipal || 'ST2JXKMSH007NPYAQHKJPQMAQYAD90NQGTVJVQ02.autoscholar-payments',
      stateMachine: ['created', 'paid', 'consumed'],
      readOnlyFns: ['get-invoice', 'get-invoice-status', 'is-paid', 'is-consumed', 'has-replay-key'],
      publicFns: ['create-invoice', 'pay-invoice', 'consume-payment'],
      backendVerificationModel: 'contract-state-aware',
      currentState: contractState
    },
    paymentFlow: buildPaymentFlow(),
    extractedAssets,
    serviceManifest: extras.serviceManifest || [],
    taskTree: extras.taskTree || null,
    commerceTrace: extras.commerceTrace || null,
    outputs: extras.outputManifest || null,
    citations,
    paymentCitations,
    markdown: llmResult.markdown || buildFallbackMarkdownReport(topic, researchMode, topicProfile, evidenceBundle, llmResult, citations)
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
    providerApiStyle: OPENAI_API_STYLE,
    paperSource: 'expanded arxiv topic evidence + internal frameworks',
    paymentProtocolMode: ALLOW_DEMO_PAYMENTS ? 'stacks-x402-with-demo-fallback' : 'stacks-x402-strict',
    paymentRail: PAYMENT_RAIL,
    orchestrationMode: 'topic-aware AI Parliament + x402/Stacks premium unlock',
    stacksIntegration: {
      network: STACKS_NETWORK,
      apiBase: STACKS_API_BASE,
      verification: 'clarity-contract-path-scaffold',
      recipientModel: 'platform-treasury-address',
      payerModel: 'user-wallet-connect',
      contractLanguage: 'Clarity'
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
    logWarn('research.create.invalid_topic', { requestId: req.requestId, body: req.body });
    return res.status(400).json({ error: 'topic is required' });
  }

  try {
    const preparedResearch = await retrieveEvidence(topic);
    const researchMode = preparedResearch.researchMode || deriveResearchMode(topic);
    const topicProfile = preparedResearch.topicProfile || deriveTopicProfile(topic);
    const evidenceBundle = preparedResearch;
    const id = makeId();
    const stacksPayment = buildStacksPaymentRequest({ jobId: id, amount: PAYMENT_AMOUNT, asset: process.env.STACKS_PAYMENT_ASSET || 'STX' });
    const clarityPayment = buildClarityPaymentSpec({
      jobId: id,
      recipient: stacksPayment.recipient,
      amount: PAYMENT_AMOUNT,
      asset: stacksPayment.asset,
      memo: stacksPayment.memo,
      contract: stacksPayment.contract,
      paymentId: stacksPayment.paymentId,
      expiresAt: stacksPayment.expiresAt,
      nonce: stacksPayment.nonce
    });
    stacksPayment.clarity = clarityPayment;
    const x402Challenge = buildX402Challenge({ jobId: id, amount: PAYMENT_AMOUNT, asset: stacksPayment.asset, paymentRequest: stacksPayment });
    const job = {
      id,
      topic,
      searchQuery: evidenceBundle.query,
      researchMode,
      topicProfile,
      paperSource: 'expanded arxiv topic evidence + internal frameworks',
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
        asset: stacksPayment.asset,
        amount: PAYMENT_AMOUNT,
        recipient: stacksPayment.recipient,
        payer: stacksPayment.payer,
        assetType: stacksPayment.assetType,
        challenge: 'HTTP 402 Payment Required',
        specialist: 'Image Extractor Molbot',
        reason: 'Premium synthesis, AI Parliament debate, and extracted assets unlock after payment.',
        stacks: stacksPayment,
        clarity: clarityPayment,
        x402: x402Challenge,
        verificationPlan: buildClarityVerificationPlan({ ...stacksPayment, clarity: clarityPayment })
      },
      extractedAssets: [],
      report: null
    };

    job.serviceManifest = buildServiceManifest(job);
    job.taskTree = buildTaskTree(job, 'quote-issued');
    job.commerceTrace = buildCommerceTrace(job, 'quote-issued');
    job.outputs = buildOutputManifest(job);

    seedContractInvoiceState({
      jobId: id,
      invoiceStatus: 'created',
      paymentRequest: job.paymentRequest
    });
    job.contractState = await readContractInvoiceState({
      jobId: id,
      paymentRequest: job.paymentRequest
    });

    jobs.set(id, job);
    logInfo('research.create.success', {
      requestId: req.requestId,
      jobId: id,
      topic,
      researchMode,
      evidenceCount: evidenceBundle.topicEvidence?.length || 0,
    });
    return res.status(202).json(job);
  } catch (error) {
    logError('research.create.failed', {
      requestId: req.requestId,
      topic,
      error,
    });
    return res.status(500).json({ error: error.message || 'failed to create job' });
  }
});

app.post('/api/jobs/:id/pay', async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    logWarn('payment.job_not_found', { requestId: req.requestId, jobId: req.params.id });
    return res.status(404).json({ error: 'job not found' });
  }

  if (job.paymentReceipt) {
    logWarn('payment.already_paid', { requestId: req.requestId, jobId: job.id, txid: job.paymentReceipt.txid });
    return res.status(409).json({ error: 'job is already paid', paymentReceipt: job.paymentReceipt, contractState: job.contractState });
  }

  if (isPaymentRequestExpired(job.paymentRequest?.stacks)) {
    logWarn('payment.request_expired', { requestId: req.requestId, jobId: job.id, expiresAt: job.paymentRequest?.stacks?.expiresAt });
    return res.status(410).json({
      error: 'payment request expired',
      x402: job.paymentRequest?.x402,
      stacks: job.paymentRequest?.stacks
    });
  }

  const token = req.header('x-payment-token') || req.body?.paymentToken;
  const authorization = req.body?.authorization || null;
  if (!req.body?.txid && !(ALLOW_DEMO_PAYMENTS && token === DEMO_PAYMENT_TOKEN)) {
    logWarn('payment.proof_missing', { requestId: req.requestId, jobId: job.id });
    const headers = buildX402Headers(job.paymentRequest.x402);
    Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
    return res.status(402).json({
      error: 'payment required',
      message: 'Provide a Stacks transaction proof and matching x402 authorization to unlock the AI Parliament report.',
      expectedBody: ['txid', 'sender', 'authorization'],
      x402: job.paymentRequest.x402,
      stacks: job.paymentRequest.stacks
    });
  }

  try {
    let paymentReceipt;
    const authResult = validatePaymentAuthorization(authorization || {
      paymentId: job.paymentRequest.x402.paymentId,
      nonce: job.paymentRequest.x402.nonce,
      expiresAt: job.paymentRequest.x402.expiresAt,
      resource: job.paymentRequest.x402.resource,
      amount: job.paymentRequest.x402.maxAmountRequired,
    }, job.paymentRequest.x402);

    if (!authResult.ok) {
      logWarn('payment.authorization_invalid', {
        requestId: req.requestId,
        jobId: job.id,
        reason: authResult.reason,
      });
      return res.status(400).json({ error: 'invalid payment authorization', reason: authResult.reason });
    }

    if (req.body?.txid) {
      logInfo('payment.verification.start', {
        requestId: req.requestId,
        jobId: job.id,
        txid: req.body.txid,
        sender: req.body.sender,
      });
      const verification = await verifyStacksPayment({
        txid: req.body.txid,
        sender: req.body.sender,
        recipient: job.paymentRequest.stacks.recipient,
        amount: job.paymentRequest.amount,
        asset: job.paymentRequest.asset,
        memo: job.paymentRequest.stacks.memo,
        jobId: job.id,
        contract: job.paymentRequest.stacks.contract,
        paymentId: job.paymentRequest.x402.paymentId,
        paymentRequest: job.paymentRequest.stacks
      });

      if (!verification.ok) {
        logWarn('payment.verification.failed', {
          requestId: req.requestId,
          jobId: job.id,
          txid: req.body.txid,
          sender: req.body.sender,
          verification,
        });
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
        memo: verification.memo,
        verificationTarget: verification.verificationTarget,
        paymentId: verification.paymentId || job.paymentRequest.x402.paymentId,
        nonce: job.paymentRequest.x402.nonce,
        expiresAt: job.paymentRequest.x402.expiresAt,
        verificationSource: verification.mode,
        invoiceStatus: 'paid',
        contractStateReader: 'get-invoice-status',
        nextContractAction: 'consume-payment',
        stateMachine: ['created', 'paid', 'consumed']
      };
      logInfo('payment.verification.success', {
        requestId: req.requestId,
        jobId: job.id,
        txid: verification.txid,
        sender: verification.sender,
        recipient: verification.recipient,
        amount: verification.amount,
      });
    } else if (ALLOW_DEMO_PAYMENTS && token === DEMO_PAYMENT_TOKEN) {
      paymentReceipt = {
        asset: job.paymentRequest.asset,
        amount: job.paymentRequest.amount,
        txid: 'demo-stacks-txid',
        sender: 'user-wallet-connect',
        recipient: job.paymentRequest.recipient,
        settlement: 'mock-success',
        mode: 'simulated-chain-payment',
        chain: job.paymentRequest.stacks.network,
        apiBase: job.paymentRequest.stacks.apiBase,
        memo: job.paymentRequest.stacks.memo,
        verificationTarget: 'clarity-contract-call',
        paymentId: job.paymentRequest.x402.paymentId,
        nonce: job.paymentRequest.x402.nonce,
        expiresAt: job.paymentRequest.x402.expiresAt,
        verificationSource: 'demo-verification',
        invoiceStatus: 'paid',
        contractStateReader: 'get-invoice-status',
        nextContractAction: 'consume-payment',
        stateMachine: ['created', 'paid', 'consumed']
      };
      logWarn('payment.demo_used', { requestId: req.requestId, jobId: job.id });
    } else {
      logWarn('payment.txid_missing', { requestId: req.requestId, jobId: job.id });
      return res.status(400).json({ error: 'txid is required for non-demo payments' });
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
    job.serviceManifest = buildServiceManifest(job);
    job.taskTree = buildTaskTree(job, 'processing');
    job.commerceTrace = buildCommerceTrace(job, 'processing');
    job.outputs = buildOutputManifest(job);
    jobs.set(job.id, job);

    const evidenceBundle = {
      topicEvidence: job.papers || [],
      paymentEvidence: job.paymentEvidence || [],
      combined: [...(job.papers || []), ...(job.paymentEvidence || [])],
      query: job.searchQuery
    };

    const llmResult = await generateReport(job.topic, job.researchMode, job.topicProfile, evidenceBundle);
    const usedFallback = llmResult.mode === 'fallback' || llmResult.mode === 'python-fallback';
    if (usedFallback) {
      logWarn('report.fallback_used', {
        requestId: req.requestId,
        jobId: job.id,
        topic: job.topic,
        llmMode: llmResult.mode,
        llmError: llmResult.error || null,
      });
    } else {
      logInfo('report.generated', {
        requestId: req.requestId,
        jobId: job.id,
        topic: job.topic,
        llmMode: llmResult.mode,
      });
    }

    job.status = usedFallback ? 'completed_with_fallback' : 'completed';
    job.orchestration.meetingStatus = 'concluded';
    job.paidAt = new Date().toISOString();
    job.paymentReceipt = paymentReceipt;
    job.contractState = await markContractInvoicePaid({
      jobId: job.id,
      paymentRequest: job.paymentRequest,
      paymentReceipt
    });
    job.extractedAssets = extractedAssets;
    job.llm = {
      mode: llmResult.mode,
      model: OPENAI_MODEL,
      providerBaseUrl: OPENAI_BASE_URL,
      providerApiStyle: OPENAI_API_STYLE,
      error: llmResult.error || null
    };
    job.serviceManifest = buildServiceManifest(job);
    job.taskTree = buildTaskTree(job, usedFallback ? 'completed-with-fallback' : 'completed', llmResult, extractedAssets);
    job.commerceTrace = buildCommerceTrace(job, usedFallback ? 'completed-with-fallback' : 'completed', llmResult, extractedAssets);
    job.report = buildResearchReport(
      job.topic,
      job.researchMode,
      job.topicProfile,
      evidenceBundle,
      llmResult,
      extractedAssets,
      job.contractState,
      {
        serviceManifest: job.serviceManifest,
        taskTree: job.taskTree,
        commerceTrace: job.commerceTrace
      }
    );
    job.outputs = buildOutputManifest(job, evidenceBundle, job.report, job.taskTree, job.commerceTrace);
    job.report.outputs = job.outputs;

    jobs.set(job.id, job);
    logInfo('payment.complete', {
      requestId: req.requestId,
      jobId: job.id,
      txid: job.paymentReceipt?.txid,
      status: job.status,
      llmMode: job.llm?.mode,
    });
    return res.json(job);
  } catch (error) {
    job.status = 'failed';
    job.error = error.message || 'failed to complete payment flow';
    jobs.set(job.id, job);
    logError('payment.complete.failed', {
      requestId: req.requestId,
      jobId: job.id,
      txid: req.body?.txid || null,
      error,
    });
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

app.get('/api/jobs/:id/contract-state', async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'job not found' });
  }

  const state = await readContractInvoiceState({
    jobId: job.id,
    paymentRequest: job.paymentRequest,
    paymentReceipt: job.paymentReceipt || null
  });

  return res.json(state);
});

app.post('/api/jobs/:id/consume', async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    logWarn('consume.job_not_found', { requestId: req.requestId, jobId: req.params.id });
    return res.status(404).json({ error: 'job not found' });
  }

  if (!job.paymentReceipt) {
    logWarn('consume.before_payment', { requestId: req.requestId, jobId: job.id });
    return res.status(400).json({ error: 'job is not paid yet' });
  }

  if (job.paymentReceipt?.invoiceStatus === 'consumed') {
    logWarn('consume.already_consumed', { requestId: req.requestId, jobId: job.id });
    return res.status(409).json({ error: 'payment is already consumed', contractState: job.contractState, paymentReceipt: job.paymentReceipt });
  }

  job.contractState = await markContractInvoiceConsumed({
    jobId: job.id,
    paymentRequest: job.paymentRequest,
    paymentReceipt: {
      ...job.paymentReceipt,
      invoiceStatus: 'consumed',
      nextContractAction: null
    }
  });

  job.paymentReceipt = {
    ...job.paymentReceipt,
    invoiceStatus: 'consumed',
    nextContractAction: null
  };
  jobs.set(job.id, job);
  logInfo('consume.success', {
    requestId: req.requestId,
    jobId: job.id,
    txid: job.paymentReceipt?.txid,
  });
  return res.json({ ok: true, contractState: job.contractState, paymentReceipt: job.paymentReceipt });
});

const server = app.listen(PORT, () => {
  logInfo('server.started', { port: PORT, logPath: getLogPath() });
  console.log(`AutoScholar backend listening on http://localhost:${PORT}`);
});

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    logError('server.port_in_use', { port: PORT, error });
    console.error(`Port ${PORT} is already in use. Set PORT to a free port and retry.`);
    process.exit(1);
  }
  logError('server.start_failed', { error });
  console.error('Backend server failed to start:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logError('process.unhandled_rejection', { reason });
});

process.on('uncaughtException', (error) => {
  logError('process.uncaught_exception', { error });
});

let shutdownStarted = false;

async function shutdown(signal) {
  if (shutdownStarted) return;
  shutdownStarted = true;
  logInfo('server.shutdown.start', { signal });
  await new Promise((resolve) => {
    server.close(() => resolve());
  });
  logInfo('server.shutdown.complete', { signal });
  process.exit(0);
}

process.on('SIGINT', () => {
  shutdown('SIGINT').catch((error) => {
    logError('server.shutdown.failed', { signal: 'SIGINT', error });
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch((error) => {
    logError('server.shutdown.failed', { signal: 'SIGTERM', error });
    process.exit(1);
  });
});
