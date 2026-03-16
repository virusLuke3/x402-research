# Project Status

This file tracks the current shape of AutoScholar as a working hackathon project.

## Goal

Ship a convincing specialized-skill molbot that:

- accepts arbitrary research tasks
- packages them as a quoted workflow
- settles premium access through x402 on Stacks
- returns outputs that another agent can reuse

## Current Scope

Implemented:

- frontend dashboard for intake, payment, trace, and outputs
- backend manager workflow
- x402-style challenge and quote packaging
- Clarity payment contract scaffold
- Stacks testnet payment signing and Hiro verification
- research pipeline with `arXiv + OpenReview + local frameworks`
- markdown dossier plus JSON output bundle

Not yet implemented:

- independently deployed specialist molbots
- persistent job storage
- non-STX settlement rails
- registry and discovery layer
- production-grade monitoring and ops

## Near-Term Priorities

1. Keep demo and docs fully aligned with the current implementation.
2. Strengthen the specialist-service story in the UI and outputs.
3. Split at least one specialist path into a separately callable service.
4. Add a cleaner agent-facing API surface for downstream automation.

## Product Risks

- overclaiming agent-to-agent settlement beyond the live implementation
- stale docs drifting away from the product UI
- demo reliability if wallet or testnet conditions are not prepared in advance

## Success Criteria

The project is in a strong state if a reviewer can immediately understand:

- what the service is
- how x402 is used
- where Stacks fits
- what becomes available after payment
- why another molbot would buy these outputs
