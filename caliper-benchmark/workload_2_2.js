'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const axios = require('axios');
const crypto = require('crypto');
const hvac = require('node-vault');

const CTI_UUID = '';
const VAULT_ADDR = process.env.VAULT_ADDR || 'http://172.18.0.3:8200';
const VAULT_TOKEN = process.env.CTI_CONSUMER_TOKEN || '';
const IPFS_ADD_URL = process.env.IPFS_ADD_URL || 'http://172.18.0.3:9094/add';
const IPFS_GET_URL = process.env.IPFS_GET_URL || 'http://172.18.0.3:8080/ipfs';

class ReadCTIMetadataWorkload extends WorkloadModuleBase {
    async submitTransaction() {
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

            if (Array.isArray(responses)) {
                responseObj = responses[0]?.status?.result;
            } else if (responses && typeof responses === 'object') {
                responseObj = responses.status?.result;
            } else {
                console.error(`Unexpected responses type: ${JSON.stringify(responses)}`);
                return;
            }

            if (typeof responseObj === 'object' && responseObj !== null && Object.keys(responseObj).every(k => !isNaN(Number(k)))) {
                const buf = Buffer.from(Object.values(responseObj));
                responseStr = buf.toString('utf8');
            } else if (typeof responseObj === 'string') {
                responseStr = responseObj;
            } else {
                console.error(`Unexpected response format: ${JSON.stringify(responseObj)}`);
                return;
            }
        } catch (err) {
            console.error(`Error querying Fabric or parsing response: ${err}`);
            return;
        }

        // 2. Parse metadata
        try {
            metadata = JSON.parse(responseStr);
        } catch (e) {
            console.error(`Failed to parse metadata: ${responseStr}`);
            return;
        }
        if (!metadata || !metadata.CID) {
            console.error(`Metadata not found or missing CID: ${JSON.stringify(metadata)}`);
            return;
        }

        // 3. Fetch encrypted CTI from IPFS
        try {
            const ipfsRes = await axios.get(`${IPFS_GET_URL}/${metadata.CID}`, { responseType: 'arraybuffer' });
            encryptedData = Buffer.from(ipfsRes.data);
        } catch (e) {
            console.error(`Failed to fetch from IPFS: ${e}`);
            return;
        }

        // 4. Fetch AES key from Vault
        try {
            const vault = hvac({ endpoint: VAULT_ADDR, token: VAULT_TOKEN });
            const vaultRes = await vault.read(metadata.VaultKey);
            aesKey = Buffer.from(vaultRes.data.data.value, 'base64');
        } catch (e) {
            console.error(`Failed to fetch AES key from Vault: ${e}`);
            return;
        }

        // 5. Decrypt CTI
        try {
            const iv = encryptedData.slice(0, 16); // Use 16 bytes for IV/nonce
            const tag = encryptedData.slice(encryptedData.length - 16);
            const ciphertext = encryptedData.slice(16, encryptedData.length - 16);
            const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
            decipher.setAuthTag(tag);
            decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        } catch (e) {
            console.error(`Failed to decrypt CTI: ${e}`);
            return;
        }

        // 6. Hash and compare
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

function createWorkloadModule() {
    return new ReadCTIMetadataWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;