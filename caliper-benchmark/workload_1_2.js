'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

const CTI_UUID = '';

class ReadCTIMetadataWorkload extends WorkloadModuleBase {
    constructor() {
        super();
    }

    /**
     * Assemble and submit transactions for the round.
     * @return {Promise<void>}
     */
    async submitTransaction() {
        const request = {
            contractId: this.roundArguments.chaincodeId,
            contractFunction: 'ReadCTIMetadata',
            contractArguments: [CTI_UUID],
            channel: this.roundArguments.channel,
            timeout: 30,
            readOnly: true
        };

        await this.sutAdapter.sendRequests(request);
    }
}

/**
 * Create a new instance of the workload module.
 * @return {WorkloadModuleInterface}
 */
function createWorkloadModule() {
    return new ReadCTIMetadataWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;