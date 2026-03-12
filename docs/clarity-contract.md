# AutoScholar Clarity Contract Notes

## Contract
- `contracts/autoscholar-payments.clar`
- principal target (current scaffold): `ST2AUTOSCHOLARTESTNETTREASURY111111111111111.autoscholar-payments`

## Purpose
Model invoice lifecycle for x402 premium unlocks:
1. backend creates invoice for `job-id`
2. payer calls `pay-invoice`
3. backend verifies paid state
4. backend consumes payment when premium unlock is granted

## Current status model
- `u0` → created / unpaid
- `u1` → paid
- `u2` → consumed

## Public functions
- `create-invoice`
- `pay-invoice`
- `consume-payment`

## Read-only functions
- `get-invoice`
- `is-paid`
- `is-consumed`

## Next steps
- replace scaffold transfer assumptions with real asset transfer enforcement / post-conditions
- tie backend verification to actual contract state reads on testnet
- add anti-replay / duplicate settlement hardening around `consume-payment`
- deploy via Clarinet once real deployer credentials are provided
