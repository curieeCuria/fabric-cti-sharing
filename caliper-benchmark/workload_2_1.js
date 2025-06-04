'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const vault = require('node-vault');

const vaultClient = vault({ endpoint: 'http://172.20.0.2:8200', token: '' });

class CreateCTIMetadataWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
    }

    async submitTransaction() {
        this.txIndex++;

        // 1. Generate AES key (32 bytes for AES-256)
        const aesKey = crypto.randomBytes(32);

        // 2. Encrypt data using AES-GCM, 25KB
        const filePath = path.resolve(__dirname, '../cti/sample_cti_25kb.json');
        let plainData;
        try {
            plainData = fs.readFileSync(filePath);
        } catch (err) {
            throw new Error(`Failed to read file: ${filePath}, error: ${err}`);
        }
        
        const nonce = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, nonce);
        const encrypted = Buffer.concat([cipher.update(plainData), cipher.final()]);
        const tag = cipher.getAuthTag();
        const encryptedPayload = Buffer.concat([nonce, encrypted, tag]);

        // 3. Store encrypted data in IPFS
        const form = new FormData();
        form.append('file', encryptedPayload, { filename: 'data' });

        const response = await axios.post('http://172.20.0.2:9094/add', form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        const cid = response.data.cid || response.data.Hash;

        // 4. Store AES key in Vault
        const vaultKeyName = `caliper-key-${this.txIndex}`;
        await vaultClient.write(`kv-v2/data/${vaultKeyName}`, { data: { value: aesKey.toString('base64') } });

        // 5. Send metadata to Fabric
        const uuid = `test-${Date.now()}-${this.txIndex}`;
        const args = {
            UUID: uuid,
            Description: `Test Metadata ${this.txIndex}`,
            Timestamp: new Date().toISOString(),
            SenderIdentity: 'HeadOfOperations',
            CID: cid.toString(),
            VaultKey: vaultKeyName,
            SHA256Hash: crypto.createHash('sha256').update(plainData).digest('hex'),
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

        // Enforce 1 second per transaction if tps is 1
        if (this.roundArguments && this.roundArguments.tps === 1) {
            const elapsed = Date.now() - start;
            if (elapsed < 1000) {
                await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
            }
        }
    }
}

function createWorkloadModule() {
    return new CreateCTIMetadataWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;