'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vault = require('node-vault');

const FILE_TO_SEND = 'sample_cti_25kb.json';

// Configure Vault client (adjust endpoint/token as needed)
const vaultClient = vault({
    endpoint: process.env.VAULT_ADDR || 'http://172.18.0.3:8200',
    token: process.env.CTI_CREATOR_TOKEN || ''
});

class FabricVaultWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
        this.fileToSend = FILE_TO_SEND;
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        this.fileToSend = FILE_TO_SEND;
    }

    async submitTransaction() {
        this.txIndex++;

        // 1. Read the file
        const filePath = path.resolve(__dirname, '../cti', this.fileToSend);
        let plainData;
        try {
            plainData = fs.readFileSync(filePath);
        } catch (err) {
            throw new Error(`Failed to read file: ${filePath}, error: ${err}`);
        }

        // 2. Generate AES key (32 bytes for AES-256)
        const aesKey = crypto.randomBytes(32);

        // 3. Encrypt the file using AES-GCM
        const nonce = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, nonce);
        const encrypted = Buffer.concat([cipher.update(plainData), cipher.final()]);
        const tag = cipher.getAuthTag();
        const encryptedPayload = Buffer.concat([nonce, encrypted, tag]);

        // 4. Store AES key in Vault
        const vaultKeyName = `caliper-key-${this.txIndex}`;
        await vaultClient.write(`kv-v2/data/${vaultKeyName}`, { data: { value: aesKey.toString('base64') } });

        // 5. Prepare metadata, arbitrary CID
        const uuid = `test-${Date.now()}-${this.txIndex}`;
        const args = {
            UUID: uuid,
            Description: `Test Metadata ${this.txIndex}`,
            Timestamp: new Date().toISOString(),
            SenderIdentity: 'HeadOfOperations',
            CID: `Qm${crypto.randomBytes(32).toString('hex')}`,
            VaultKey: vaultKeyName,
            SHA256Hash: crypto.createHash('sha256').update(plainData).digest('hex'),
            AccessList: ['HeadOfOperations']
        };

        // 6. Send metadata to Fabric
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
    return new FabricVaultWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;