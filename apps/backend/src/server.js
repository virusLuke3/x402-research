import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import express from 'express';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

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
    .replace(/summarize|latest|papers|paper|include|core|architecture|diagrams|diagram/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'ZK Rollup';
}

async function fetchArxivPapers(query) {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=5&sortBy=relevance&sortOrder=descending`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'AutoScholar/0.1 (hackathon research demo)'
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

    return {
      id: id || `arxiv-${index + 1}`,
      title,
      summary,
      published,
      authors
    };
  }).filter((paper) => paper.title);
}

async function generateLLMSummary(topic, papers) {
  if (!OPENAI_API_KEY) {
    return {
      mode: 'fallback',
      summary: `OpenAI-compatible key not configured. Fallback summary for ${topic}.`,
      keyFindings: papers.slice(0, 3).map((paper) => `${paper.title} — ${paper.summary.slice(0, 180)}...`),
      implications: []
    };
  }

  const apiUrl = `${OPENAI_BASE_URL.replace(/\/$/, '')}/chat/completions`;
  const helperPath = path.resolve(__dirname, './llm_tuzi.py');

  const payload = {
    api_url: apiUrl,
    api_key: OPENAI_API_KEY,
    model: OPENAI_MODEL,
    topic,
    papers,
  };

  return await new Promise((resolve, reject) => {
    const child = spawn('python3', [helperPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`LLM helper failed: ${stdout || stderr}`.trim()));
      }
      try {
        const parsed = JSON.parse(stdout);
        if (!parsed.ok) {
          return reject(new Error(parsed.error || 'LLM helper returned failure'));
        }
        return resolve({ mode: 'llm-python', ...parsed.result });
      } catch (error) {
        return reject(new Error(`Failed to parse LLM helper output: ${stdout || stderr}`.trim()));
      }
    });

    child.on('error', (error) => reject(error));
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

function buildFallbackReport(topic, papers, llmResult, extractedAssets) {
  return {
    title: `AutoScholar report: ${topic}`,
    summary: llmResult.summary,
    keyFindings: llmResult.keyFindings || [],
    implications: llmResult.implications || [],
    papers,
    extractedAssets,
    nextSteps: [
      'Replace demo payment token verification with real Stacks settlement verification.',
      'Add PDF-native diagram extraction from downloaded paper sources.',
      'Persist jobs, payment receipts, and research outputs in durable storage.'
    ]
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
    const papers = await fetchArxivPapers(searchQuery);
    const id = makeId();
    const job = {
      id,
      topic,
      searchQuery,
      paperSource: 'arXiv',
      papers,
      status: 'awaiting-payment',
      createdAt: new Date().toISOString(),
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

    const llmResult = await generateLLMSummary(job.topic, job.papers || []);

    job.status = 'completed';
    job.paidAt = new Date().toISOString();
    job.paymentReceipt = {
      asset: 'USDCx',
      amount: '0.5',
      txid: 'demo-stacks-txid',
      settlement: 'mock-success',
      mode: 'simulated-chain-payment'
    };
    job.extractedAssets = extractedAssets;
    job.report = buildFallbackReport(job.topic, job.papers || [], llmResult, extractedAssets);

    jobs.set(job.id, job);
    return res.json(job);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'failed to complete payment flow' });
  }
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);

  if (!job) {
    return res.status(404).json({ error: 'job not found' });
  }

  return res.json(job);
});

app.listen(PORT, () => {
  console.log(`AutoScholar backend listening on http://localhost:${PORT}`);
});
