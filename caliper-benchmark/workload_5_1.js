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

// Define create/read ratios for each round
const CREATE_READ_RATIOS = [
    0.05, // Round 0: 5% create, 95% read
    0.25, // Round 1: 25% create, 75% read
    0.50, // Round 2: 50% create, 50% read
    0.75, // Round 3: 75% create, 25% read
    0.95  // Round 4: 95% create, 5% read
];

class MixedCTIMetadataWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.createRatio = CREATE_READ_RATIOS[roundIndex];
    }

    async submitTransaction() {
        this.txIndex++;

        // Use the round's create/read ratio
        const isCreate = Math.random() < this.createRatio;

        if (isCreate) {
            // 1. Generate AES key (32 bytes for AES-256)
            let aesKey, plainData, encryptedPayload, cid, vaultKeyName;
            try {
                aesKey = crypto.randomBytes(32);

                // 2. Encrypt data using AES-GCM, 25KB file
                const filePath = path.resolve(__dirname, '../cti/sample_cti_25kb.json');
                plainData = fs.readFileSync(filePath);

                const nonce = crypto.randomBytes(16);
                const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, nonce);
                const encrypted = Buffer.concat([cipher.update(plainData), cipher.final()]);
                const tag = cipher.getAuthTag();
                encryptedPayload = Buffer.concat([nonce, encrypted, tag]);
            } catch (err) {
                console.error(`Error during encryption or file read: ${err}`);
                return;
            }

            // 3. Store encrypted data in IPFS
            try {
                const form = new FormData();
                form.append('file', encryptedPayload, { filename: 'data' });

                const response = await axios.post('http://172.18.0.3:9094/add', form, {
                    headers: form.getHeaders(),
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                });
                cid = response.data.cid || response.data.Hash;
            } catch (err) {
                console.error(`Error uploading to IPFS: ${err}`);
                return;
            }

            // 4. Store AES key in Vault
            try {
                vaultKeyName = `caliper-key-${this.txIndex}`;
                await vaultClient.write(`kv-v2/data/${vaultKeyName}`, { data: { value: aesKey.toString('base64') } });
            } catch (err) {
                console.error(`Error writing AES key to Vault: ${err}`);
                return;
            }

            // 5. Send metadata to Fabric
            try {
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
            } catch (err) {
                console.error(`Error sending metadata to Fabric: ${err}`);
                return;
            }

        } else {
            // ReadCTIMetadata
            let responses, responseObj, responseStr, metadata, encryptedData, aesKey, decrypted;
            // 1. Query Fabric for metadata
            try {
                const request = {
                    contractId: this.roundArguments.chaincodeId,
                    contractFunction: 'ReadCTIMetadata',
                    contractArguments: [CTI_UUID],
                    channel: this.roundArguments.channel,
                    timeout: 30,
                    readOnly: true
                };
                responses = await this.sutAdapter.sendRequests(request);

                // 2. Parse metadata from Fabric response
                if (Array.isArray(responses)) {
                    responseObj = responses[0]?.status?.result;
                } else if (responses && typeof responses === 'object') {
                    responseObj = responses.status?.result;
                } else {
                    console.error(`Unexpected responses type: ${JSON.stringify(responses)}`);
                    return;
                }
                if (!responseObj) {
                    console.error('No result in Fabric response:', responses);
                    return;
                }
                if (typeof responseObj === 'object' && responseObj !== null && Object.keys(responseObj).every(k => !isNaN(Number(k)))) {
                    const buf = Buffer.from(Object.values(responseObj));
                    responseStr = buf.toString('utf8');
                } else if (typeof responseObj === 'string') {
                    responseStr = responseObj;
                } else {
                    responseStr = JSON.stringify(responseObj);
                }
                try {
                    metadata = JSON.parse(responseStr);
                } catch (e) {
                    console.error(`Failed to parse metadata: ${responseStr}`);
                    return;
                }
                if (!metadata || !metadata.CID || !metadata.VaultKey) {
                    console.error(`Metadata missing CID or VaultKey: ${JSON.stringify(metadata)}`);
                    return;
                }
            } catch (err) {
                console.error(`Error querying Fabric or parsing metadata: ${err}`);
                return;
            }

            // 3. Fetch encrypted data from IPFS
            try {
                const ipfsRes = await axios.get(`http://172.18.0.3:8080/ipfs/${metadata.CID}`, { responseType: 'arraybuffer' });
                encryptedData = Buffer.from(ipfsRes.data);
            } catch (e) {
                console.error(`Failed to fetch from IPFS: ${e}`);
                return;
            }

            // 4. Fetch AES key from Vault
            try {
                const vaultRes = await vaultClient.read(`${metadata.VaultKey}`);
                aesKey = Buffer.from(vaultRes.data.data.value, 'base64');
            } catch (e) {
                console.error(`Failed to fetch AES key from Vault: ${e}`);
                return;
            }

            // 5. Decrypt data using AES-GCM
            try {
                const iv = encryptedData.slice(0, 16);
                const tag = encryptedData.slice(encryptedData.length - 16);
                const ciphertext = encryptedData.slice(16, encryptedData.length - 16);
                const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
                decipher.setAuthTag(tag);
                decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
            } catch (e) {
                console.error(`Failed to decrypt CTI: ${e}`);
                return;
            }

            // 6. Verify hash
            try {
                const expectedHash = metadata.SHA256Hash;
                const hash = crypto.createHash('sha256').update(decrypted).digest('hex');
                if (hash !== expectedHash) {
                    console.error(`Hash mismatch: expected ${expectedHash}, got ${hash}`);
                    return;
                }
            } catch (e) {
                console.error(`Failed to verify hash: ${e}`);
                return;
            }
        }
    }
}

function createWorkloadModule() {
    return new MixedCTIMetadataWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;