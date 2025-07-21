'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const FILE_TO_SEND = 'sample_cti_25kb.json';

class FabricIPFSWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
        this.fileToSend = FILE_TO_SEND;
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
    }

    async submitTransaction() {
        this.txIndex++;

        // 1. Read the file
        const filePath = path.resolve(__dirname, '../cti', this.fileToSend);
        let fileData;
        try {
            fileData = fs.readFileSync(filePath);
        } catch (err) {
            throw new Error(`Failed to read file: ${filePath}, error: ${err}`);
        }

        // 2. Store file data in IPFS
        const form = new FormData();
        form.append('file', fileData, { filename: this.fileToSend });

        const response = await axios.post('http://172.18.0.3:9094/add', form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        const cid = response.data.cid || response.data.Hash;

        // 3. Prepare metadata
        const uuid = `test-${Date.now()}-${this.txIndex}`;
        const args = {
            UUID: uuid,
            Description: `Test Metadata ${this.txIndex}`,
            Timestamp: new Date().toISOString(),
            SenderIdentity: 'HeadOfOperations',
            CID: cid.toString(),
            VaultKey: 'asd', // Not used
            SHA256Hash: 'asd', // Not used
            AccessList: ['HeadOfOperations']
        };

        // 4. Send metadata to Fabric
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

function createWorkloadModule() {
    return new FabricIPFSWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;