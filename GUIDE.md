# AutoScholar Submission Guide

This guide is the shortest path to presenting AutoScholar clearly during judging, demo recording, or async review.

## One-Sentence Pitch

AutoScholar is a specialized research molbot that uses x402 on Stacks to quote premium research workflows, verify payment, and return outputs that other agents can consume.

## Positioning

The strongest way to frame the project is:

- not as a generic AI search tool
- not as a simple paywall
- but as a paid research capability in an agent-to-agent economy

The core idea is that high-value research becomes a reusable service with clear entitlement, settlement, and deliverable packaging.

## What To Emphasize

### Innovation

- research is packaged as a commerce primitive
- outputs are designed for downstream agents, not only humans
- the workflow is exposed as a task tree and commerce trace

### Technical Depth

- frontend task orchestration UI
- backend quote creation and workflow packaging
- Python research pipeline for evidence retrieval and synthesis
- Clarity invoice scaffold
- Stacks testnet verification through Hiro

### Stacks Alignment

- settlement is executed on Stacks testnet
- the payment path is modeled as a contract call, not a fake success toggle
- the repo includes a Clarity contract and contract-oriented verification logic

### User Experience

- the user sees exactly what the service bundle costs
- payment unlocks premium capabilities with a visible trace
- results arrive as both a readable dossier and structured JSON packets

## What Is Real Today

- task creation and scoping
- x402 challenge metadata
- Stacks wallet signing flow
- Hiro-backed transaction verification
- task tree and commerce trace objects
- markdown and JSON output bundle

## What Is Not Yet Fully Implemented

- independent networked molbots paying each other across separate services
- real sBTC or USDCx transfer rails
- on-chain registry and reputation for specialist discovery

This matters in judging. Be ambitious in the vision, but precise about what is live.

## Recommended Demo Story

Use this flow in a live demo or video:

1. Enter a research topic.
2. Show that the manager molbot prepares a quote and pre-payment evidence.
3. Highlight the task tree and specialist bundle.
4. Connect a Stacks wallet and sign the parent invoice.
5. Show payment verification and specialist unlock.
6. Open the final dossier and JSON deliverables.
7. Close with the agent handoff packet as proof that another molbot can reuse the work.

## Suggested Narration

You can adapt this script directly:

> AutoScholar turns premium research into an x402-powered service on Stacks. A manager molbot scopes the task, prepares evidence, issues a quote, and only releases the paid specialist bundle after on-chain payment is verified. The result is not just a report for a human. It is a machine-readable handoff packet that another agent can purchase and use.

## Judge-Facing Talking Points

If judges ask why this fits the bounty:

- it is a specialized-skill molbot
- it prices a premium capability
- it uses x402 as the authorization and entitlement layer
- it uses Stacks as the settlement layer
- it delivers artifacts another molbot can buy and consume

If judges ask about settlement assets:

- the current implementation is STX-first
- the architecture is intentionally compatible with future sBTC and USDCx rails

If judges ask whether delegation is real:

- the current release packages delegation as a first-class task tree and commerce trace
- the next step is to split specialists into separately deployable services

## Submission Checklist

- keep the README aligned with the live product
- use screenshots that show task tree, settlement, and deliverables
- record a demo under five minutes
- avoid claiming sBTC or USDCx transfers are live if the repo still settles in STX
- keep the narration focused on molbot-to-molbot commerce, not only research quality

## Recommended Assets For Submission

- homepage screenshot
- payment trace screenshot
- completed dossier screenshot
- short architecture diagram
- 3-5 minute demo video

## Short FAQ

### Why research?

Because high-value research is easy to understand as a premium specialist capability and naturally benefits from structured outputs.

### Why x402?

Because x402 gives the workflow a machine-readable payment challenge and entitlement layer.

### Why Stacks?

Because settlement and verification are anchored in the Stacks ecosystem, which is exactly what the hackathon is asking teams to explore.
