# Demo Runbook

This document is the fastest way to present AutoScholar clearly in a live demo or a recorded pitch.

## Demo Goal

Show that AutoScholar is not just a research UI. It is a paid molbot workflow with visible quoting, settlement, verification, and agent-readable delivery.

## Before You Start

Prepare these items first:

- frontend and backend running locally
- wallet installed and switched to `Stacks testnet`
- enough testnet STX in the wallet
- deployed `autoscholar-payments.clar`
- `.env` configured with the deployed contract principal and recipient

## Recommended Prompt

Use a prompt that makes the specialist workflow obvious. For example:

```text
Design a molbot-to-molbot commerce protocol on Stacks using x402, and package the research outputs so downstream agents can reuse them.
```

You can also use a domain-specific task such as Solidity security research if you want the dossier to feel more concrete.

## 3-Minute Demo Flow

### 1. Show the intake screen

Say:

> AutoScholar accepts a research task the way another agent would describe it: what needs to be investigated, what decision it should support, and what outputs are expected.

### 2. Create the task

Point out:

- the quote is generated before payment
- evidence is staged before premium unlock
- the task tree explains which specialists will be released

### 3. Show the payment layer

Say:

> Instead of directly unlocking a report, AutoScholar issues an x402-style challenge and a parent invoice on Stacks.

Point out:

- wallet connection
- quoted amount
- settlement status
- commerce trace

### 4. Sign the transaction

Say:

> The payer signs `pay-invoice` on Stacks testnet. The app waits for Hiro confirmation before releasing paid capabilities.

### 5. Show verification and outputs

Point out:

- payment confirmation state
- specialist bundle unlock
- final markdown dossier
- JSON outputs for downstream agents

### 6. Close with the product thesis

Say:

> The important part is not only that a user got a report. Another molbot can now buy and reuse the research brief, evidence pack, citation ledger, and handoff packet.

## Backup Narrative If Testnet Is Slow

If confirmation takes too long, keep the story moving:

- show the task tree
- show the parent invoice
- show the expected verification flow
- explain that payment verification is Hiro-backed and the UI is waiting on chain finality

Do not pretend confirmation already happened if it has not.

## What Judges Usually Care About

### Why is this more than a paywall?

Because the output bundle is structured for downstream agents and the workflow is modeled as a commerce trace, not only a locked markdown page.

### Is the payment real?

The current implementation uses a real Stacks testnet contract-call flow and server-side verification through Hiro.

### Are the specialist molbots separate services yet?

Not fully. The current release packages them as explicit workflow objects inside one product, with separate deployment as the next evolution step.

## Common Failure Points

- wallet is connected to the wrong network
- contract principal in `.env` does not match the deployed contract
- testnet wallet does not have enough STX
- the backend was started before updated environment variables were loaded

## Best Recording Sequence

1. homepage and positioning
2. task intake
3. quote and task tree
4. wallet connect
5. payment signing
6. verification state
7. dossier and JSON outputs

That sequence makes the hackathon fit obvious in under five minutes.
