# Architecture

## Current MVP Architecture

AutoScholar currently uses a hybrid implementation where research content and payment rail are intentionally separated: the user topic drives retrieval and debate, while x402 + Stacks powers premium unlock and settlement semantics. In V7.1, the payment model is fixed to Stacks testnet, the recipient is modeled as a platform treasury address, the payer is modeled as a connected user wallet, and the settlement path is explicitly structured for future Clarity-smart-contract integration.

- **Frontend**: React + Vite dashboard
- **Backend**: Express manager service
- **Evidence discovery**: mixed retrieval (local x402/Stacks knowledge base + arXiv API)
- **LLM summarization**: TuZi OpenAI-compatible endpoint via Python helper
- **Payment**: simulated x402 / Stacks-style payment receipt

## Why a Python helper exists

The TuZi provider works with direct HTTP calls when proxy variables are removed. The local Node runtime path showed compatibility issues during integration, so the current MVP uses a small Python helper that:

- strips proxy-related environment variables
- sends the OpenAI-compatible request directly
- returns normalized JSON to the backend

This keeps the hackathon demo moving while preserving the intended user flow.

## Planned evolution

1. replace the helper with a native Node adapter once provider compatibility is stabilized
2. split specialist molbots into separate services
3. move from simulated payment receipts to Stacks testnet transaction verification
4. add true diagram extraction from PDF sources
5. expand x402 / Stacks local knowledge base into first-class protocol documentation retrieval
