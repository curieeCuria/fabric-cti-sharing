'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const vault = require('node-vault');

// Configure Vault client (adjust endpoint/token as needed)
const vaultClient = vault({
    endpoint: process.env.VAULT_ADDR || 'http://172.18.0.3:8200',
    token: process.env.CTI_CONSUMER_TOKEN || ''
});

const CTI_UUID = ''; // sample_cti_25kb.json

class FabricVaultReadWorkload extends WorkloadModuleBase {
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
            responseStr = JSON.stringify(responseObj);
        }

        // Parse metadata
        let metadata;
        try {
            metadata = JSON.parse(responseStr);
        } catch (e) {
            throw new Error(`Failed to parse metadata: ${responseStr}`);
        }
        if (!metadata || !metadata.VaultKey) {
            throw new Error(`Metadata not found or missing VaultKey: ${JSON.stringify(metadata)}`);
        }

        // 3. Fetch AES key from Vault
        try {
            const vaultRes = await vaultClient.read(metadata.VaultKey);
            const aesKey = vaultRes.data.data.value;
            // You now have the AES key (base64 string) from Vault
        } catch (e) {
            throw new Error(`Failed to fetch AES key from Vault: ${e}`);
        }
    }
}

function createWorkloadModule() {
    return new FabricVaultReadWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;