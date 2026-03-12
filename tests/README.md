# Clarinet Test Notes

These tests validate the AutoScholar Clarity payment contract in two layers:

1. `clarinet check` validates Clarity syntax and analysis.
2. `vitest` validates that the contract source still exposes the expected state machine, replay protection, and public/read-only entry points.

## Current status
In the current environment:
- `clarinet check` runs successfully
- `vitest run tests/autoscholar-payments.test.ts` runs successfully

This is not yet full transaction-level Clarinet SDK simulation, but it is now executable and guards the contract surface from silent regressions.
