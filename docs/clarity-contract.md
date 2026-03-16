# Clarity Contract Notes

## Contract

- file: `contracts/autoscholar-payments.clar`
- role: invoice-style payment scaffold for premium unlocks

## Purpose

The contract models a simple parent-invoice lifecycle:

1. the backend creates an invoice for a job
2. the payer calls `pay-invoice`
3. the backend verifies that the invoice was settled as expected
4. the backend marks the payment as consumed when the premium bundle is released

This keeps the unlock flow legible and gives the backend a clear verification target.

## State Model

- `u0`: created and unpaid
- `u1`: paid
- `u2`: consumed

## Public Functions

- `create-invoice`
- `pay-invoice`
- `consume-payment`

## Read-Only Functions

- `get-invoice`
- `is-paid`
- `is-consumed`

## Verification Expectations

The backend-side verification path is contract-oriented. It checks:

- target contract principal
- public function name
- expected arguments
- expected amount semantics
- x402 authorization payload consistency

## Deployment Notes

For live testnet use, make sure:

- the contract is deployed to Stacks testnet
- `.env` points to the correct contract principal
- the configured recipient and amount match the deployment setup

## Current Limitations

- the production-grade asset model is not finished
- the live repo path is still STX-first
- more anti-replay and duplicate-settlement hardening can be added over time

## Next Steps

- strengthen contract-state verification against live reads
- expand beyond the current STX-first path
- add additional hardening around settlement consumption
