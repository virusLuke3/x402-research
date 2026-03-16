# Test Notes

The current test layer focuses on protecting the payment contract surface and the expected verification model.

## What Runs

`npm test` executes:

1. `clarinet check` for Clarity syntax and static analysis
2. `vitest run tests/autoscholar-payments.test.ts` for contract-surface assertions

## What These Tests Protect

- expected public and read-only entry points
- invoice lifecycle assumptions
- replay-protection and payment-state expectations

## Current Boundary

This is not yet a full transaction-by-transaction Clarinet SDK simulation suite. It is a lightweight but useful safety layer that catches silent regressions in the contract interface and payment model.
