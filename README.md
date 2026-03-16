# AutoScholar

AutoScholar is an x402-powered research molbot network on Stacks.

It turns premium research into a commerce primitive:

- a requester submits a topic or decision-support task
- a manager molbot scopes the work and stages evidence before payment
- the backend returns an x402 challenge plus Stacks settlement metadata
- verified payment unlocks a paid specialist bundle
- the system ships both human-readable and agent-readable deliverables

The result is not just a paywalled report. It is a machine-consumable research service that other agents can hire.

## Why This Project Fits The Theme

AutoScholar is positioned as a specialized-skill molbot for agentic commerce:

- research is the paid service
- x402 is the entitlement and challenge layer
- Stacks is the settlement and verification layer
- the output bundle is designed for both humans and downstream agents

This maps directly to the hackathon prompt: molbots interacting with each other, delegating work, and paying for premium capabilities on Stacks.

## What The Demo Shows

1. A requester creates a research task in the frontend.
2. The manager molbot prepares a pre-payment evidence pack.
3. The backend issues an x402 challenge and parent invoice metadata.
4. The user signs a `pay-invoice` contract call on Stacks testnet.
5. The frontend polls Hiro until the transaction succeeds.
6. The backend verifies the transaction plus x402 authorization payload.
7. The paid specialist bundle is released and the final deliverables are packaged.

## Product Surface

### Human-facing

- task intake UI
- wallet connection and settlement status
- task tree and commerce trace panels
- payment readiness diagnostics
- final markdown research dossier

### Agent-facing

- x402 challenge metadata
- parent-invoice and settlement details
- task tree describing unlocked specialist work
- commerce trace describing quote, payment, verification, and delivery
- JSON deliverables for downstream automation

## Deliverables

After a verified payment, AutoScholar packages:

- `Research Dossier`
  - format: `markdown`
  - audience: `human + agent`
  - contents: synthesis, implications, limitations, citations
- `Research Brief`
  - format: `json`
  - audience: `agent`
  - contents: summary, key findings, consensus, next actions
- `Evidence Pack`
  - format: `json`
  - audience: `agent`
  - contents: structured evidence shortlist and extracted assets
- `Citation Ledger`
  - format: `json`
  - audience: `agent`
  - contents: normalized citations and payment references
- `Agent Handoff Packet`
  - format: `json`
  - audience: `agent`
  - contents: task, payment, trace, and deliverable inventory

## Research Coverage

The current research pipeline combines:

- `arXiv` retrieval
- `OpenReview` retrieval
- local topic frameworks and protocol notes

The current implementation does not include a separate source named `OpenResearch`. If you mean `OpenReview`, it is already covered.

## Architecture Snapshot

- frontend: React + Vite dashboard
- backend: Express API for task intake, x402 challenge creation, settlement verification, and report packaging
- research pipeline: Python retrieval and synthesis workflow
- settlement rail: Stacks testnet verification through Hiro
- contract: Clarity invoice-style payment scaffold

## Repo Layout

```text
apps/
  backend/   Express manager service and research pipeline bridge
  frontend/  React dashboard for intake, payment, trace, and outputs

contracts/
  autoscholar-payments.clar   Clarity payment contract scaffold

docs/
  architecture.md             System architecture and lifecycle notes
  demo.md                     Demo script and presenter notes
  clarity-contract.md         Contract behavior and verification notes
  比赛要求.md                  Hackathon requirement mapping in Chinese
```

## Quick Start

### Requirements

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Configure

Copy `.env.example` to `.env` and fill in the required values.

Common local settings include:

- `OPENAI_BASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `STACKS_NETWORK`
- `STACKS_API_BASE`
- `STACKS_PAYMENT_CONTRACT`
- `STACKS_RECIPIENT`
- `STACKS_PAYMENT_AMOUNT`

### Run

```bash
npm run dev
```

This starts:

- frontend on `http://localhost:5173`
- backend on `http://localhost:8787`

To point the frontend at a different backend:

```bash
VITE_API_BASE=http://localhost:8790 npm --workspace apps/frontend run dev
```

## Payment Readiness

The backend exposes `GET /api/payment/readiness` so the frontend can show:

- whether key `STACKS_*` variables are present
- whether the configured contract is deployed on testnet
- the effective payment amount and asset
- what is missing before a real settlement can succeed

Important notes:

- the current live settlement path is `STX-first`
- `STACKS_PAYMENT_AMOUNT` must be an integer micro-STX amount
- sBTC and USDCx are part of the product narrative and future roadmap, not a fully implemented transfer path in this repo

## Real Testnet Flow

To complete a real wallet flow you need:

- a wallet on `Stacks testnet`
- testnet STX
- a deployed `autoscholar-payments.clar` contract
- `.env` updated with the deployed contract principal and recipient

Once configured, the live path is:

1. create a research task
2. receive quote and x402 challenge metadata
3. sign `pay-invoice`
4. wait for Hiro confirmation
5. verify payment server-side
6. unlock the specialist bundle and final outputs

## Tests

Run the contract and integration checks with:

```bash
npm test
```

This runs:

- `clarinet check`
- `vitest run tests/autoscholar-payments.test.ts`

## Documentation Guide

- [GUIDE.md](/Users/jiahuaiyu/develop/hackthon/x402-research/GUIDE.md): submission framing and presenter notes
- [PROJECT.md](/Users/jiahuaiyu/develop/hackthon/x402-research/PROJECT.md): internal scope and roadmap
- [docs/architecture.md](/Users/jiahuaiyu/develop/hackthon/x402-research/docs/architecture.md): system architecture
- [docs/demo.md](/Users/jiahuaiyu/develop/hackthon/x402-research/docs/demo.md): demo runbook
- [docs/clarity-contract.md](/Users/jiahuaiyu/develop/hackthon/x402-research/docs/clarity-contract.md): contract notes
- [tests/README.md](/Users/jiahuaiyu/develop/hackthon/x402-research/tests/README.md): test coverage notes

## Current Status

What is real today:

- frontend task intake and workflow UI
- x402-style challenge creation
- task tree and commerce trace packaging
- Stacks testnet payment signing
- Hiro-backed verification
- markdown plus JSON output bundle

What is still a next step:

- separate deployable specialist molbots
- non-STX settlement rails such as sBTC or USDCx
- registry and discovery between independent molbots
- persistent storage and production operations
