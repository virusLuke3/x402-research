# Project Management

## Goal
Build a hackathon-ready MVP for AutoScholar based on GUIDE.md, where arbitrary research topics are handled by a deep research / AI Parliament workflow, while x402 protocol design and Stacks-native settlement serve as the premium payment-unlock layer.

## Current MVP Scope
- [x] Create repo guide and project framing
- [x] Scaffold backend service
- [x] Scaffold frontend UI
- [x] Implement x402-style 402 payment challenge flow
- [x] Implement demo manager job lifecycle
- [x] Produce local development instructions
- [ ] Replace mock payment with real Stacks settlement
- [ ] Add real specialist PDF / diagram extraction
- [ ] Add persistent storage
- [ ] Add wallet / funding UX
- [ ] Add demo video assets and screenshots
- [x] Replace unstable Python TuZi adapter with backend-native fetch integration

## Milestones

### Milestone 1 — Architecture & docs
Completed.

### Milestone 2 — Running MVP
Completed in demo mode.

### Milestone 3 — Crypto-native settlement
Pending.

### Milestone 4 — Production-grade specialist agents
Pending.

## Risks
- real chain settlement may add latency and wallet complexity
- PDF/image extraction quality depends on model / tool selection
- true multi-agent orchestration needs careful state management

## Immediate Next Actions
1. add real payment verification path
2. add one real specialist endpoint
3. add submission-facing screenshots and demo script
4. validate provider credentials before demo so fallback mode is only a safety net
5. keep TuZi auth isolated from stale shell env overrides during local runs
