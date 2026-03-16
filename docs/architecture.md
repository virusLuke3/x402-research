# Architecture

AutoScholar is built as a research workflow with a separate payment and entitlement layer. The research topic drives retrieval and synthesis, while x402 plus Stacks controls premium access and settlement.

## System Overview

- frontend: React + Vite dashboard
- backend: Express manager service
- research pipeline: Python retrieval and synthesis workflow
- settlement rail: Stacks testnet contract-call path
- verification source: Hiro API

## Request Lifecycle

1. A requester submits a topic.
2. The backend creates a job and derives a research profile.
3. The research pipeline stages pre-payment evidence from supported sources.
4. The backend returns:
   - job metadata
   - x402 challenge metadata
   - parent invoice metadata
   - service manifest
   - task tree
   - commerce trace
5. After payment, the frontend signs a Stacks contract call.
6. The backend verifies the transaction against expected contract, function, args, and x402 authorization.
7. Verified payment unlocks the specialist bundle and report packaging.
8. The final response includes markdown plus machine-readable outputs.

## Research Layer

The current pipeline combines:

- `arXiv` papers
- `OpenReview` papers
- local topic frameworks
- local protocol notes where relevant

This means the research layer is broader than a single search API. It is a topic-aware evidence pipeline with synthesis and report generation.

## Payment Layer

The payment layer is modeled as a parent invoice:

- the backend quotes the specialist bundle
- the frontend requests wallet approval
- the payer signs `pay-invoice`
- Hiro is polled until the transaction reaches success
- the backend validates settlement semantics before releasing paid outputs

The current live path is `STX-first`. sBTC and USDCx belong to the roadmap and product narrative, not the fully implemented on-chain transfer path in this repository.

## Task Tree And Commerce Trace

Two objects are central to the product story:

- `taskTree`
  - explains which specialists are involved
  - shows the parent and child work items
  - makes delegation visible to judges and users
- `commerceTrace`
  - explains quote creation, payment expectation, verification, and delivery
  - makes the x402 and settlement lifecycle legible

These objects are useful both for the UI and for downstream agents.

## Output Model

The final output bundle is intentionally mixed-format:

- markdown for humans
- JSON packets for agents

Current output artifacts include:

- `Research Dossier`
- `Research Brief`
- `Evidence Pack`
- `Citation Ledger`
- `Agent Handoff Packet`

## Why The Python Pipeline Exists

The current research workflow is implemented in Python because retrieval, synthesis, debate, and report generation are grouped there today. The Node backend acts as the manager and payment-facing orchestration layer.

This is a practical split for the current stage of the project:

- Node owns HTTP, wallet-facing flow, and settlement verification
- Python owns evidence retrieval and research synthesis

## Known Boundaries

- specialists are still bundled inside one product experience rather than fully separated network services
- there is no registry or reputation layer yet
- payment verification is real on testnet, but the broader molbot economy is still represented through protocol objects and workflow structure

## Evolution Path

1. split specialist capabilities into separately deployable services
2. expose a cleaner agent-facing API for paid invocation
3. add non-STX settlement rails
4. add registry and discovery for specialized molbots
5. add persistence, observability, and production hardening
