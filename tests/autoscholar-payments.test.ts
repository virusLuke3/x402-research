import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('autoscholar-payments contract scaffold', () => {
  const contractPath = path.resolve(process.cwd(), 'contracts/autoscholar-payments.clar');
  const contract = fs.readFileSync(contractPath, 'utf8');

  it('includes required public functions', () => {
    expect(contract).toContain('(define-public (create-invoice');
    expect(contract).toContain('(define-public (pay-invoice');
    expect(contract).toContain('(define-public (consume-payment');
  });

  it('includes required read-only functions', () => {
    expect(contract).toContain('(define-read-only (get-invoice');
    expect(contract).toContain('(define-read-only (get-invoice-status');
    expect(contract).toContain('(define-read-only (is-paid');
    expect(contract).toContain('(define-read-only (is-consumed');
    expect(contract).toContain('(define-read-only (has-replay-key');
  });

  it('defines the expected payment state machine', () => {
    expect(contract).toContain('(define-constant status-created u0)');
    expect(contract).toContain('(define-constant status-paid u1)');
    expect(contract).toContain('(define-constant status-consumed u2)');
  });

  it('includes replay protection data', () => {
    expect(contract).toContain('(define-map consumed-payments');
    expect(contract).toContain('(define-constant err-replay-detected (err u109))');
  });
});
