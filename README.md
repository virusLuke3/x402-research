# AutoScholar

AutoScholar is an x402-powered deep research agent network prototype for DoraHacks BUIDL Battle 2. The current version is wired for a real Stacks testnet payment loop: the frontend can connect a Leather/Xverse wallet, call `pay-invoice`, wait for Hiro confirmation, and submit `txid + sender + x402 authorization` back to the backend for verification and premium unlock.

It demonstrates this flow:
- a **Manager Molbot** receives a complex research request
- it queries **arXiv** for relevant papers
- it delegates a specialist task to a paid **Image Extractor Molbot**
- the specialist returns an **HTTP 402 Payment Required** challenge
- the user signs a Stacks testnet contract call from their wallet
- the backend verifies the transaction against Hiro and the x402 challenge
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
- real Stacks testnet verification through Hiro API

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

## Payment Readiness

The backend now exposes `GET /api/payment/readiness`, which the frontend uses to show:
- whether `.env` has real `STACKS_PAYMENT_CONTRACT` / `STACKS_RECIPIENT`
- whether the configured contract is actually deployed on Stacks testnet
- the effective payment amount and asset
- what is still needed before a real Leather payment can succeed

Important:
- the backend loads `.env` before Stacks modules initialize, so changing `STACKS_*` values now correctly affects the running service
- `STACKS_PAYMENT_AMOUNT` must be an integer micro-STX amount, for example `500000` for `0.5 STX`

## Real Testnet Flow

1. Open the frontend.
2. Submit a research prompt.
3. The manager searches arXiv and creates a job in `awaiting-payment`.
4. The UI shows the x402-style challenge from the specialist molbot.
5. Click **connect wallet** or **connect + pay** and approve the Stacks testnet contract call in Leather.
6. The frontend polls Hiro until the transaction reaches `success`.
7. The backend verifies the contract call, args, transfer event, and x402 authorization, then returns the completed report.
8. If the provider credentials are invalid, the backend returns a fallback report instead of failing the whole payment flow.

To make step 5 succeed with a real Leather wallet, you need:
- a Leather wallet switched to `Stacks testnet`
- testnet STX in that wallet
- a deployed `autoscholar-payments.clar` contract on testnet
- `.env` values for `STACKS_PAYMENT_CONTRACT` and `STACKS_RECIPIENT` updated to that deployment

## Secure Deployment

To avoid storing a real mnemonic in `settings/Testnet.toml`, use the one-shot deployment helper:

```bash
./scripts/deploy-testnet.sh
```

It will:
- load `STACKS_DEPLOYER_MNEMONIC` from `.env` if present
- use `STACKS_DEPLOYMENT_COST_STRATEGY` from `.env` if present, defaulting to `manual`
- prompt for the deployer mnemonic without echoing it
- create a temporary Clarinet settings file outside the repo workflow
- generate and apply the testnet deployment
- remove the temporary file when the command exits

If you prefer shell-scoped secrets instead of an interactive prompt, you can also do:

```bash
read -r -s STACKS_DEPLOYER_MNEMONIC
export STACKS_DEPLOYER_MNEMONIC
./scripts/deploy-testnet.sh
unset STACKS_DEPLOYER_MNEMONIC
```

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
- `OPENAI_API_STYLE`
- `OPENAI_MODEL`
- `LLM_TIMEOUT_MS`
- `RESEARCH_TIMEOUT_MS`
- `BACKEND_LOG_PATH`
- `ALLOW_DEMO_PAYMENTS`
- `STACKS_NETWORK`
- `STACKS_API_BASE`
- `STACKS_PAYMENT_ASSET`
- `STACKS_PAYMENT_AMOUNT`
- `STACKS_PAYMENT_MEMO_PREFIX`
- `STACKS_CHALLENGE_TTL_SECONDS`
- `STACKS_PAYMENT_CONTRACT`
- `STACKS_RECIPIENT`

Recommended local dev pairing for this repo:
- `OPENAI_BASE_URL=https://api.tu-zi.com/v1`
- `OPENAI_API_STYLE=chat-completions`
- `OPENAI_MODEL=gpt-5.4`
- `OPENAI_API_KEY=<your TuZi API key>`

If your provider exposes the OpenAI `responses` API instead of `chat/completions`, set:
- `OPENAI_BASE_URL=<provider /v1 base>` and `OPENAI_API_STYLE=responses`
- or point `OPENAI_BASE_URL` directly at the full `/responses` endpoint

Recommended timeout floor for slower GPT-5.x research runs:
- `LLM_TIMEOUT_MS=60000`
- `RESEARCH_TIMEOUT_MS=300000`

Backend logs:
- default path is `logs/backend.log`
- each line is JSON, intended for error forensics rather than frontend display

## Current Status

Implemented:
- frontend dashboard
- backend orchestration API
- arXiv paper search
- x402 challenge flow with Stacks settlement metadata
- real wallet contract-call path in the frontend
- Hiro-backed transaction verification in the backend
- payment readiness diagnostics for `.env` and contract deployment
- OpenAI-compatible summarization through backend-native fetch requests to the configured provider

Still simulated / pending:
- real PDF-native diagram extraction
- persistent storage
- multi-specialist routing
