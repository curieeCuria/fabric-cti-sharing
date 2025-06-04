'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Map round index to file name
const ROUND_FILES = [
    'sample_cti_2kb.json',
    'sample_cti_10kb.json',
    'sample_cti_25kb.json',
    'sample_cti_50kb.json',
    'sample_cti_100kb.json',
    'sample_cti_250kb.json'
];

class FabricIPFSWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
        this.fileToSend = null;
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        // Pick file based on round index, fallback to first if out of range
        this.fileToSend = ROUND_FILES[roundIndex] || ROUND_FILES[0];
    }

    async submitTransaction() {
        this.txIndex++;

        // 1. Read the file for this round
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

        const response = await axios.post('http://172.20.0.2:9094/add', form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        const cid = response.data.cid || response.data.Hash;

        // 3. Send metadata to Fabric
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