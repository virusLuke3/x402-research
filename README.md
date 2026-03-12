# AutoScholar

AutoScholar is an x402-powered deep research agent network prototype for DoraHacks BUIDL Battle 2. In V7.0, the research topic is topic-agnostic while the premium unlock path is upgraded into a real-ready x402 + Stacks payment scaffold with explicit agent identities, Stacks network metadata, payment memos, and txid-based verification hooks.

It demonstrates this flow:
- a **Manager Molbot** receives a complex research request
- it queries **arXiv** for relevant papers
- it delegates a specialist task to a paid **Image Extractor Molbot**
- the specialist returns an **HTTP 402 Payment Required** challenge
- the manager simulates Stacks-style settlement
- a summarizer model is called directly from the backend through an **OpenAI-compatible provider**
- the final research result is returned as a combined report

## Repo Structure

```text
apps/
  backend/   Express API for manager flow, arXiv search, and x402-style challenge
  frontend/  React + Vite demo UI
  
docs/
  architecture.md  Current architecture notes and evolution plan
GUIDE.md     Product, architecture, MVP, and hackathon positioning
PROJECT.md   Simple project management status
```

## Local Development

### Requirements
- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Configure

Copy `.env.example` to `.env` and fill in values.

Current local setup uses:
- TuZi OpenAI-compatible API at `https://api.tu-zi.com/v1`
- model `gpt-5.4`
- evidence source `local x402/stacks knowledge base + arXiv`
- simulated x402 challenge + Stacks-style chain payment

### Run

```bash
npm run dev
```

This starts:
- frontend on `http://localhost:5173`
- backend on `http://localhost:8787`

If you need to point the frontend at a different backend port during local debugging, set:

```bash
VITE_API_BASE=http://localhost:8790 npm --workspace apps/frontend run dev
```

## Demo Flow

1. Open the frontend.
2. Submit a research prompt.
3. The manager searches arXiv and creates a job in `awaiting-payment`.
4. The UI shows the x402-style challenge from the specialist molbot.
5. Click **Simulate chain payment and continue**.
6. The backend simulates payment verification, calls the summarizer model, and returns a completed report.
7. If the provider credentials are invalid, the backend now returns a fallback report instead of failing the whole demo flow.

Implementation note:
- The backend loads `.env` with `override: true` so stale shell-level keys do not shadow the intended TuZi credentials.
- The TuZi LLM call is executed through `apps/backend/src/llm_tuzi.py`, which matches the verified Python request path for this environment.

## Configuration

Environment variables:

- `PORT`
- `FRONTEND_ORIGIN`
- `DEMO_PAYMENT_TOKEN`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`

Recommended local dev pairing for this repo:
- `OPENAI_BASE_URL=https://api.tu-zi.com/v1`
- `OPENAI_MODEL=gpt-5.4`
- `OPENAI_API_KEY=<your TuZi API key>`

## Current Status

Implemented:
- frontend dashboard
- backend orchestration API
- arXiv paper search
- x402-style payment challenge flow
- simulated chain payment receipt
- OpenAI-compatible summarization through backend-native fetch requests to the configured provider

Still simulated / pending:
- real on-chain Stacks payment verification
- real PDF-native diagram extraction
- persistent storage
- multi-specialist routing
