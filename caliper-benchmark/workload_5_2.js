'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class MixedCTIMetadataWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
        this.createdUUIDs = [];
    }

    async submitTransaction() {
        this.txIndex++;

        // Decide function: 20% Create, 80% Read
        const isCreate = Math.random() < 0.2;
        let func, args;

        if (isCreate || this.createdUUIDs.length === 0) {
            // Always create if no UUIDs exist yet
            func = 'CreateCTIMetadata';
            const uuid = `test-${Date.now()}-${this.txIndex}`;
            args = {
                UUID: uuid,
                Description: `Test Metadata ${this.txIndex}`,
                Timestamp: new Date().toISOString(),
                SenderIdentity: 'HeadOfOperations',
                CID: `CID${this.txIndex}`,
                VaultKey: `vaultKey${this.txIndex}`,
                SHA256Hash: `hash${this.txIndex}`,
                AccessList: ['HeadOfOperations']
            };
            // Store the UUID for future reads
            this.createdUUIDs.push(uuid);
        } else {
            func = 'ReadCTIMetadata';
            // Pick a random UUID from created ones
            const uuid = this.createdUUIDs[Math.floor(Math.random() * this.createdUUIDs.length)];
            args = uuid;
        }

        const request = {
            contractId: this.roundArguments.chaincodeId,
            contractFunction: func,
            contractArguments: [typeof args === 'string' ? args : JSON.stringify(args)],
            channel: this.roundArguments.channel,
            timeout: 30,
            user: this.roundArguments.user,
            organization: this.roundArguments.organization
        };

        await this.sutAdapter.sendRequests(request);
    }
}

function createWorkloadModule() {
    return new MixedCTIMetadataWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;