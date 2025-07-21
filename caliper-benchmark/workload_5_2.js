'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const vault = require('node-vault');

// Configure Vault client
const vaultClient = vault({
    endpoint: process.env.VAULT_ADDR || 'http://172.18.0.3:8200',
    token: process.env.CTI_CREATOR_TOKEN || ''
});

// Use a single constant UUID for all operations
const CTI_UUID = '';

class MixedCTIMetadataWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
    }

    async submitTransaction() {
        this.txIndex++;

        // 20% Create, 80% Read
        const isCreate = Math.random() < 0.2;

        if (isCreate) {
            // 1. Generate AES key (32 bytes for AES-256)
            const aesKey = crypto.randomBytes(32);

            // 2. Encrypt data using AES-GCM, 25KB file
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

            const response = await axios.post('http://172.18.0.3:9094/add', form, {
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
                contractFunction: 'CreateCTIMetadata',
                contractArguments: [JSON.stringify(args)],
                channel: this.roundArguments.channel,
                timeout: 30
            };

            await this.sutAdapter.sendRequests(request);

        } else {
            // ReadCTIMetadata
            // 1. Query Fabric for metadata
            const request = {
                contractId: this.roundArguments.chaincodeId,
                contractFunction: 'ReadCTIMetadata',
                contractArguments: [CTI_UUID],
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
                console.error('Unexpected responses type:', responses);
                return;
            }
            if (!responseObj) {
                console.error('No result in Fabric response:', responses);
                return;
            }
            let responseStr;
            if (typeof responseObj === 'object' && responseObj !== null && Object.keys(responseObj).every(k => !isNaN(Number(k)))) {
                const buf = Buffer.from(Object.values(responseObj));
                responseStr = buf.toString('utf8');
            } else if (typeof responseObj === 'string') {
                responseStr = responseObj;
            } else {
                responseStr = JSON.stringify(responseObj);
            }
            let metadata;
            try {
                metadata = JSON.parse(responseStr);
            } catch (e) {
                throw new Error(`Failed to parse metadata: ${responseStr}`);
            }
            if (!metadata || !metadata.CID || !metadata.VaultKey) {
                throw new Error(`Metadata missing CID or VaultKey: ${JSON.stringify(metadata)}`);
            }

            // 3. Fetch encrypted data from IPFS
            let encryptedData;
            try {
                const ipfsRes = await axios.get(`http://172.18.0.3:8080/ipfs/${metadata.CID}`, { responseType: 'arraybuffer' });
                encryptedData = Buffer.from(ipfsRes.data);
            } catch (e) {
                throw new Error(`Failed to fetch from IPFS: ${e}`);
            }

            // 4. Fetch AES key from Vault
            let aesKey;
            try {
                const vaultRes = await vaultClient.read(`${metadata.VaultKey}`);
                aesKey = Buffer.from(vaultRes.data.data.value, 'base64');
            } catch (e) {
                throw new Error(`Failed to fetch AES key from Vault: ${e}`);
            }

            // 5. Decrypt data using AES-GCM
            let decrypted;
            try {
                const iv = encryptedData.slice(0, 16);
                const tag = encryptedData.slice(encryptedData.length - 16);
                const ciphertext = encryptedData.slice(16, encryptedData.length - 16);
                const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
                decipher.setAuthTag(tag);
                decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
            } catch (e) {
                throw new Error(`Failed to decrypt CTI: ${e}`);
            }

            // 6. Verify hash
            const expectedHash = metadata.SHA256Hash;
            const hash = crypto.createHash('sha256').update(decrypted).digest('hex');
            if (hash !== expectedHash) {
                throw new Error(`Hash mismatch: expected ${expectedHash}, got ${hash}`);
            }
        }
    }
}

function createWorkloadModule() {
    return new MixedCTIMetadataWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;