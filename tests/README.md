# Clarinet Test Notes

These tests are scaffolds for the AutoScholar Clarity payment contract.

## Expected toolchain
- Clarinet
- `@hirosystems/clarinet-sdk`

## Planned coverage
- create invoice
- pay invoice
- consume payment
- duplicate consume blocked by replay protection

## Current status
In the current environment, `clarinet check` runs successfully and validates the contract.
The installed Clarinet CLI version does not expose the old `clarinet test` subcommand, so the TypeScript test scaffold remains in-repo as the next step for SDK-driven execution rather than being executed directly by the current CLI.
