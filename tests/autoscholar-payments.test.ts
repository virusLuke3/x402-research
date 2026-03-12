// Clarinet test scaffold for V7.5
// Run after Clarinet is installed in the environment.

import { Clarinet, Tx, Chain, Account, types } from '@hirosystems/clarinet-sdk';

Clarinet.test({
  name: 'create-invoice -> pay-invoice -> consume-payment state machine works',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    const contract = `${deployer.address}.autoscholar-payments`;

    let block = chain.mineBlock([
      Tx.contractCall('autoscholar-payments', 'create-invoice', [
        types.ascii('job-1'),
        types.principal(deployer.address),
        types.uint(500000),
        types.ascii('STX'),
        types.ascii('x402-autoscholar:job-1')
      ], deployer.address)
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    block = chain.mineBlock([
      Tx.contractCall('autoscholar-payments', 'pay-invoice', [
        types.ascii('job-1'),
        types.uint(500000),
        types.ascii('STX'),
        types.ascii('x402-autoscholar:job-1')
      ], wallet1.address)
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    let status = chain.callReadOnlyFn('autoscholar-payments', 'get-invoice-status', [types.ascii('job-1')], deployer.address);
    status.result.expectOk().expectUint(1);

    block = chain.mineBlock([
      Tx.contractCall('autoscholar-payments', 'consume-payment', [
        types.ascii('job-1'),
        types.ascii('job-1:x402-autoscholar:job-1')
      ], deployer.address)
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    status = chain.callReadOnlyFn('autoscholar-payments', 'get-invoice-status', [types.ascii('job-1')], deployer.address);
    status.result.expectOk().expectUint(2);
  }
});

Clarinet.test({
  name: 'duplicate consume-payment fails due to replay protection',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    let block = chain.mineBlock([
      Tx.contractCall('autoscholar-payments', 'create-invoice', [
        types.ascii('job-2'),
        types.principal(deployer.address),
        types.uint(500000),
        types.ascii('STX'),
        types.ascii('x402-autoscholar:job-2')
      ], deployer.address),
      Tx.contractCall('autoscholar-payments', 'pay-invoice', [
        types.ascii('job-2'),
        types.uint(500000),
        types.ascii('STX'),
        types.ascii('x402-autoscholar:job-2')
      ], wallet1.address)
    ]);

    block = chain.mineBlock([
      Tx.contractCall('autoscholar-payments', 'consume-payment', [
        types.ascii('job-2'),
        types.ascii('job-2:x402-autoscholar:job-2')
      ], deployer.address)
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    block = chain.mineBlock([
      Tx.contractCall('autoscholar-payments', 'consume-payment', [
        types.ascii('job-2'),
        types.ascii('job-2:x402-autoscholar:job-2')
      ], deployer.address)
    ]);
    block.receipts[0].result.expectErr().expectUint(109);
  }
});
