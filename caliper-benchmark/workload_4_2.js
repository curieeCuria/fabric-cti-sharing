'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const axios = require('axios');

const CTI_UUID = ''; // sample_cti_25kb.json

class ReadCTIWorkload extends WorkloadModuleBase {
    constructor() {
        super();
    }

    async submitTransaction() {
        const uuid = CTI_UUID;

        // 1. Query Fabric for metadata
        const request = {
            contractId: this.roundArguments.chaincodeId,
            contractFunction: 'ReadCTIMetadata',
            contractArguments: [uuid],
            channel: this.roundArguments.channel,
            timeout: 30,
            readOnly: true
        };
        const responses = await this.sutAdapter.sendRequests(request);

        // 2. Parse metadata from Fabric response
        let responseObj;
        if (Array.isArray(responses)) {
            responseObj = responses[0]?.status?.result;
        } else if (responses && typeof responses === 'object') {
            responseObj = responses.status?.result;
        } else {
            throw new Error(`Unexpected responses type: ${JSON.stringify(responses)}`);
        }
        let responseStr;

        if (typeof responseObj === 'object' && responseObj !== null && Object.keys(responseObj).every(k => !isNaN(Number(k)))) {
            const buf = Buffer.from(Object.values(responseObj));
            responseStr = buf.toString('utf8');
        } else if (typeof responseObj === 'string') {
            responseStr = responseObj;
        } else {
            throw new Error(`Unexpected response format: ${JSON.stringify(responseObj)}`);
        }

        // Parse metadata
        let metadata;
        try {
            metadata = JSON.parse(responseStr);
        } catch (e) {
            throw new Error(`Failed to parse metadata: ${responseStr}`);
        }
        if (!metadata || !metadata.CID) {
            throw new Error(`Metadata not found or missing CID: ${JSON.stringify(metadata)}`);
        }

        // 3. Fetch file from IPFS using CID
        try {
            const ipfsRes = await axios.get(`http://172.18.0.3:8080/ipfs/${metadata.CID}`, { responseType: 'arraybuffer' });
            // You now have the file data in ipfsRes.data (Buffer)
        } catch (e) {
            throw new Error(`Failed to fetch file from IPFS: ${e}`);
        }
    }
}

function createWorkloadModule() {
    return new ReadCTIWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;