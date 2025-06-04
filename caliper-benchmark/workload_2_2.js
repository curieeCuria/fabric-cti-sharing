'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const axios = require('axios');
const crypto = require('crypto');
const hvac = require('node-vault');

const CTI_UUID = '15bab9fa-da68-4584-ade4-02c768029916';
const VAULT_ADDR = process.env.VAULT_ADDR || 'http://172.20.0.2:8200';
const VAULT_TOKEN = process.env.CTI_CONSUMER_TOKEN || '';
const IPFS_ADD_URL = process.env.IPFS_ADD_URL || 'http://172.20.0.2:9094/add';
const IPFS_GET_URL = process.env.IPFS_GET_URL || 'http://172.20.0.2:8080/ipfs';

class ReadCTIMetadataWorkload extends WorkloadModuleBase {
    async submitTransaction() {
        // 1. Query Fabric for metadata
        const request = {
            contractId: this.roundArguments.chaincodeId,
            contractFunction: 'ReadCTIMetadata',
            contractArguments: [CTI_UUID],
            channel: this.roundArguments.channel,
            timeout: 30
        };
        const responses = await this.sutAdapter.sendRequests(request);

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

        // 2. Parse metadata
        let metadata;
        try {
            metadata = JSON.parse(responseStr);
        } catch (e) {
            throw new Error(`Failed to parse metadata: ${responseStr}`);
        }
        if (!metadata || !metadata.CID) {
            throw new Error(`Metadata not found or missing CID: ${JSON.stringify(metadata)}`);
        }

        // 3. Fetch encrypted CTI from IPFS
        let encryptedData;
        try {
            const ipfsRes = await axios.get(`${IPFS_GET_URL}/${metadata.CID}`, { responseType: 'arraybuffer' });
            encryptedData = Buffer.from(ipfsRes.data);
        } catch (e) {
            throw new Error(`Failed to fetch from IPFS: ${e}`);
        }

        // 4. Fetch AES key from Vault
        let aesKey;
        try {
            const vault = hvac({ endpoint: VAULT_ADDR, token: VAULT_TOKEN });
            const vaultRes = await vault.read(metadata.VaultKey);
            aesKey = Buffer.from(vaultRes.data.data.value, 'base64');
        } catch (e) {
            throw new Error(`Failed to fetch AES key from Vault: ${e}`);
        }

        // 5. Decrypt CTI
        let decrypted;
        try {
            const iv = encryptedData.slice(0, 16); // Use 16 bytes for IV/nonce
            const tag = encryptedData.slice(encryptedData.length - 16);
            const ciphertext = encryptedData.slice(16, encryptedData.length - 16);
            const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
            decipher.setAuthTag(tag);
            decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        } catch (e) {
            throw new Error(`Failed to decrypt CTI: ${e}`);
        }

        // 6. Hash and compare
        const expectedHash = metadata.SHA256Hash;
        const hash = crypto.createHash('sha256').update(decrypted).digest('hex');
        if (hash !== expectedHash) {
            throw new Error(`Hash mismatch: expected ${expectedHash}, got ${hash}`);
        }
    }
}

function createWorkloadModule() {
    return new ReadCTIMetadataWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;