# Sample Dossier: Solidity Security Research

This document is a polished sample of the kind of premium output AutoScholar can deliver after payment verification.

## Executive Summary

Current evidence suggests Solidity security research is best organized by vulnerability class, exploit preconditions, and mitigation patterns rather than by isolated bug anecdotes. Reentrancy and access-control failures remain two of the most important categories because they combine practical exploitability with recurring implementation mistakes.

## Research Framing

Question:

> How should a research workflow compare Solidity reentrancy issues with access-control vulnerabilities, and what conclusions are supported by current evidence?

Method:

- combine topic frameworks with paper retrieval
- separate architecture-level risks from implementation bugs
- compare exploit mechanics, mitigation patterns, and maturity of detection research

## Key Findings

- reentrancy is still a foundational class because it exposes unsafe control flow and state-update ordering
- access-control failures are often simpler in surface area but equally severe in impact
- strong analysis should distinguish exploit preconditions from exploit consequences
- mitigation advice is most useful when tied to specific failure modes rather than generic best-practice lists

## Practical Takeaways

- use taxonomy-first analysis when reviewing Solidity systems
- pair vulnerability classes with explicit mitigation patterns
- treat oracle, upgradeability, and unsafe external-call risks as adjacent categories
- keep the payment rail separate from the research conclusion itself

## Evidence Snapshot

- local Solidity security frameworks for taxonomy and review structure
- arXiv papers on vulnerability detection, repair, and comparative analysis
- synthesized report packaging for agent reuse

## Why This Matters For AutoScholar

This sample illustrates the product thesis:

- the topic itself can be arbitrary
- the premium unlock belongs to the commerce layer
- the final output can still be domain-specific, structured, and reusable

## Example Machine-Readable Outputs

The same research job can also produce:

- a `Research Brief` for downstream planning
- an `Evidence Pack` for source-level follow-up
- a `Citation Ledger` for normalized references
- an `Agent Handoff Packet` for further automation
