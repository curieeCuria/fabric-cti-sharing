'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const crypto = require('crypto');

class CreateCTIMetadataWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
    }

    /**
     * Assemble and submit transactions for the round.
     * @return {Promise<void>}
     */
    async submitTransaction() {
        this.txIndex++;

        // Generate a unique UUID using a timestamp and transaction index
        const uuid = `test-${Date.now()}-${this.txIndex}`;
        const args = {
            UUID: uuid,
            Description: `Test Metadata ${this.txIndex}`,
            Timestamp: new Date().toISOString(),
            SenderIdentity: 'HeadOfOperations',
            CID: `Qm${crypto.randomBytes(32).toString('hex')}`,
            VaultKey: `vaultKey${this.txIndex}`,
            SHA256Hash: `hash${this.txIndex}`,
            AccessList: ['HeadOfOperations']
        };

        const request = {
            contractId: this.roundArguments.chaincodeId,
            contractFunction: this.roundArguments.function,
            contractArguments: [JSON.stringify(args)],
            channel: this.roundArguments.channel,
            timeout: 30
        };

        await this.sutAdapter.sendRequests(request);
    }
}

/**
 * Create a new instance of the workload module.
 * @return {WorkloadModuleInterface}
 */
function createWorkloadModule() {
    return new CreateCTIMetadataWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;