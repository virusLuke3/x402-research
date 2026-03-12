# AutoScholar Hackathon Guide

## 1. Project Overview

**Project Name:** AutoScholar: The x402-Powered Agentic Research Network

**Hackathon:** DoraHacks BUIDL Battle 2  
**Submission Page:** https://dorahacks.io/hackathon/buidlbattle2/ideaism

**Repository:** https://github.com/virusLuke3/x402-research.git

### Elevator Pitch

AutoScholar is a decentralized multi-agent research network where specialized Molbots collaborate by hiring each other over the x402 protocol and settling payments with USDCx / sBTC on Stacks. Instead of one giant fragile agent trying to do everything, AutoScholar turns AI capabilities into composable paid microservices.

---

## 2. Problem Statement

Today, building a single all-in-one AI agent is expensive, brittle, and operationally painful.

Examples:
- long-document parsing often breaks with timeout or context issues
- PDF image extraction and diagram understanding need a different toolchain than summarization
- search, extraction, reasoning, and report writing are naturally separate tasks
- independently built agents currently lack a native trustless payment and coordination layer

The result is that useful specialist agents exist, but there is no clean decentralized economic layer for **agent-to-agent payments and service invocation**.

---

## 3. Core Idea

AutoScholar proposes a reference architecture for **Molbot-to-Molbot commerce**.

A user submits a complex research request to a **Manager Molbot**.

Example:
> Summarize the latest 2025 papers on ZK Rollups and include the core architecture diagrams.

The Manager Molbot can:
- decompose the task
- delegate sub-tasks to specialist Molbots
- pay them automatically through x402 when needed
- aggregate outputs into one final research report

This creates a decentralized AI service marketplace where each agent can specialize and monetize its capability.

---

## 4. End-to-End Flow

### Step 1: User request
The user sends a research request to the Manager Molbot.

### Step 2: Task decomposition
The Manager decides which sub-agents are needed, for example:
- paper search agent
- PDF / image extraction agent
- summarization agent
- citation / formatting agent

### Step 3: x402 challenge
If the Manager calls a paid agent endpoint without valid payment credentials, the specialist Molbot returns:
- HTTP `402 Payment Required`
- pricing information
- Stacks payment destination
- requested amount (for example `0.5 USDCx`)
- token / macaroon issuance rules after payment

### Step 4: On-chain payment
The Manager Molbot constructs and broadcasts a Stacks transaction using `@stacks/network` and `@stacks/transactions`.

### Step 5: Access grant
After successful payment, the specialist Molbot returns an access credential such as a macaroon or API token.

### Step 6: Task completion
The specialist Molbot returns its output, such as:
- extracted architecture diagrams
- parsed figures from PDFs
- structured notes
- section summaries

### Step 7: Final delivery
The Manager combines all outputs into a polished final report for the user.

---

## 5. Why AutoScholar Matters

AutoScholar is not just a research assistant. It is a **protocol pattern** for agentic commerce.

Key thesis:
- future AI systems will be networks, not monoliths
- specialist agents should be independently deployable
- those agents need trust-minimized payments
- x402 + Stacks makes machine-to-machine service commerce practical

In other words, this project reframes AI agents as **crypto-native economic actors**.

---

## 6. Technical Architecture

## 6.1 Agent Layer
Use OpenClaw, LangChain, or another open agent framework to run independent Molbots.

Example roles:
- **Manager Molbot** — orchestrates the workflow
- **Search Molbot** — finds relevant papers and metadata
- **Image Extractor Molbot** — extracts diagrams / charts from PDFs
- **Summarizer Molbot** — writes concise findings
- **Citation Molbot** — formats references and final output

## 6.2 API / x402 Layer
Each specialist Molbot exposes an HTTP API using Node.js / Express.

When a request arrives:
- if payment proof is missing or invalid, return `402 Payment Required`
- include pricing metadata and payment instructions
- after payment verification, unlock the endpoint

Possible response metadata:
- service name
- requested token (`USDCx` or `sBTC`)
- price
- Stacks contract or recipient address
- quote expiry time
- capability scope

## 6.3 Stacks Integration
Use Stacks tooling for payment execution and verification.

Suggested libraries:
- `@stacks/network`
- `@stacks/transactions`

Use cases:
- broadcast payments
- verify settlement
- derive payment receipt logic
- connect API authorization to on-chain events

## 6.4 Optional Smart Contract Layer
A bonus path is building a **Molbot Registry** contract in Clarity.

Example registry fields:
- molbot name
- endpoint URL
- supported capabilities
- base pricing
- accepted asset (`USDCx`, `sBTC`)
- developer / owner address

This turns the system into a decentralized yellow pages for agent discovery.

---

## 7. Token / Settlement Model

### Preferred assets
- **USDCx** for stable pricing of API services
- **sBTC** for strong Bitcoin ecosystem alignment

### Economic model
- each Molbot prices its own capability
- the Manager can compare providers by cost and quality
- service fees are paid per task or per endpoint call
- future extension: subscriptions, prepaid balances, escrow, reputation-weighted pricing

---

## 8. Demo Narrative

A strong demo could follow this sequence:

1. User asks for a research report on ZK Rollups.
2. Manager Molbot searches for relevant 2025 papers.
3. Manager requests architecture diagrams from Image Extractor Molbot.
4. Extractor responds with HTTP 402 and a USDCx payment request.
5. Manager signs and broadcasts a Stacks payment.
6. Extractor verifies payment and releases the extracted diagrams.
7. Summarizer Molbot writes the final report.
8. User receives a complete research package with diagrams and references.

This is easy to understand and clearly demonstrates:
- multi-agent orchestration
- x402 payment challenge flow
- Stacks settlement
- real user value

---

## 9. Judging Criteria Alignment

## Innovation
AutoScholar pushes x402 beyond human-to-machine checkout into **machine-to-machine commercial coordination**.

## Technical Depth
The project combines:
- multi-agent orchestration
- asynchronous task decomposition
- payment-gated APIs
- Stacks transaction handling
- optional smart contracts for discovery

## Stacks Alignment
The project is tightly aligned with the Stacks ecosystem:
- uses Stacks for settlement
- fits Bitcoin L2 narratives
- supports SIP-010 assets like USDCx
- can leverage fast confirmations after Nakamoto improvements

## User Experience
The user does not need to manage every micro-payment manually. The funding and payment logic happens mostly in the background between agents.

## Ecosystem Impact
This can become a reusable template:
- clone repo
- replace prompts and capabilities
- register a specialized Molbot
- join the x402 payment network

That gives the project platform potential beyond a single demo.

---

## 10. Suggested MVP Scope

To keep the hackathon build realistic, focus on a clean MVP.

### MVP components
- one **Manager Molbot**
- one **specialist paid Molbot**
- one x402-style `402 Payment Required` challenge flow
- one Stacks payment path (real or testnet)
- one final combined report output

### Best specialist choice for MVP
A good first paid Molbot is:
- **Image / diagram extraction Molbot**

Why:
- easy to explain why it is specialized
- clearly separate from summarization
- visually compelling in demo videos
- makes the value of delegation obvious

---

## 11. Suggested Repo Roadmap

Potential folders to add:

```text
x402-research/
  docs/
    architecture.md
    demo-script.md
    judges-guide.md
  manager/
  molbots/
    extractor/
    summarizer/
  contracts/
    MolbotRegistry.clar
  api/
  examples/
  GUIDE.md
```

---

## 12. Suggested Next Deliverables

Priority order:

1. refine the architecture diagram
2. define the 402 challenge / response schema
3. implement a minimal Manager Molbot
4. implement one paid specialist Molbot
5. wire payment verification to service unlock
6. produce a short end-to-end demo script
7. improve README for judges

---

## 13. Short Pitch Version

AutoScholar is a decentralized agentic research network where specialized AI Molbots collaborate and pay each other using x402 on Stacks. A manager agent decomposes a research task, hires specialist agents such as diagram extractors or summarizers, settles payments in USDCx / sBTC, and returns a unified report to the user. The project demonstrates machine-to-machine commerce for AI services and offers a reusable template for crypto-native multi-agent systems.

---

## 14. Practical Positioning

If you need to explain the project in one sentence to judges:

> AutoScholar turns specialized AI agents into crypto-native paid microservices that can trustlessly collaborate over x402 using Stacks settlement.

If you need to explain why it is important:

> The future of AI is not one giant model doing everything; it is a network of specialized agents that can discover, hire, and pay each other automatically.
