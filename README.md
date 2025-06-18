# Fabric CTI Sharing

This project provides a PoC system for securely sharing Cyber Threat Intelligence (CTI) data between organizations using Hyperledger Fabric, IPFS, and HashiCorp Vault. The system ensures secure storage, encryption, and controlled access to CTI data, enabling organizations to collaborate effectively while maintaining data confidentiality and integrity.

### Key Components:
- **Hyperledger Fabric**: Used as the blockchain platform to store and manage CTI metadata, ensuring immutability and transparency.
- **IPFS (InterPlanetary File System)**: Used to store encrypted CTI data in a decentralized manner. The Content Identifier (CID) of the stored data is included in the metadata submitted to the Fabric ledger.
- **HashiCorp Vault**: Used to securely store and retrieve AES encryption keys. The keys are used to encrypt and decrypt CTI data, ensuring that only authorized users can access the data.

The `cli.py` script serves as the command-line interface for interacting with the system, allowing users to create, retrieve, decrypt, and manage CTI metadata and data.

# CLI Usage

The `cli.py` script provides commands for creating and decrypting CTI.

Refer to the [Organization Access List](cti/README.md#organization-access-list) for permissions and actions available to each organization.

## Setting Environment Variables

Before using the CLI, ensure the following environment variables are set:

- **`VAULT_ADDR`**: The address of the Vault server. Default: `http://172.20.0.2:8200`.
- **`CTI_CREATOR_TOKEN`**: The token for the Vault client used to create CTI.
- **`CTI_CONSUMER_TOKEN`**: The token for the Vault client used to decrypt CTI.
- **`PEERNAME`**: The peer name to determine the sender identity. Default: `org1-peer0.default`.
- **`CHANNEL`**: The Fabric channel name. Default: `main`.

### Example

```bash
export VAULT_ADDR="http://172.20.0.2:8200"
export CTI_CREATOR_TOKEN="your_creator_token"
export CTI_CONSUMER_TOKEN="your_consumer_token"
export PEERNAME="org1-peer0.default"
export CHANNEL="main"
```

## Sending CTI

![create_gif](https://github.com/LasseRapo/fabric-cti-sharing/blob/main/images/FCTIS_create.gif)

Create and submit CTI metadata:

```bash
python cli.py create <filepath> <description> <roles>
```

### Example

```bash
python cli.py create cti/sample_cti.json "Malicious URL" "HeadOfOperations,TacticalUnit"
```

## Getting All CTI metadata

![getall_gif](https://github.com/LasseRapo/fabric-cti-sharing/blob/main/images/FCTIS_getall.gif)

Retrieve and display all CTI metadata:

```bash
python cli.py getall
```

This command retrieves all CTI metadata visible to the organization from the Fabric ledger and displays it in a formatted way.

## Decrypting CTI

![decrypt_gif](https://github.com/LasseRapo/fabric-cti-sharing/blob/main/images/FCTIS_decrypt.gif)

Query and decrypt CTI by UUID:

```bash
python cli.py decrypt <uuid> <output (optional)>
```

If no output path is provided, the decrypted data will be printed to the console.

### Example

```bash
python cli.py decrypt 9c01dc9d-cc3f-4b9a-8240-ac8e5b12e431 decrypted_data.json
```

## Deleting CTI metadata

Delete CTI metadata (HeadOfOperations only):

```bash
python cli.py delete <uuid>
```
---
<br>

# Deploying the System

Follow these steps to deploy the full Fabric CTI Sharing system, including the blockchain network, Vault, and IPFS:

### 1. Deploy the Hyperledger Fabric Network

The Fabric network is deployed using the [bevel-operator-fabric](bevel-operator-fabric/README.md) project, which uses Kubernetes and the HLF Operator.

- See [bevel-operator-fabric/README.md](bevel-operator-fabric/README.md) for detailed step-by-step deployment instructions.
- The steps include:
  - Creating a Kubernetes cluster
  - Deploying Istio and configuring internal DNS
  - Installing the HLF Operator and Kubectl plugin
  - Deploying Certificate Authorities, Peers, and Orderers for each organization
  - Creating channels and joining peers

For chaincode deployment and approval, see [cti/CHAINCODE_USAGE.md](cti/CHAINCODE_USAGE.md). The chaincode source is in [cti/ctiTransfer.go](cti/ctiTransfer.go) and also available on [DockerHub](https://hub.docker.com/repository/docker/betoni/cti-transfer/general).

### 2. Deploy HashiCorp Vault

See [vault/README.md](vault/README.md) for Vault deployment and initialization instructions.

### 3. Deploy IPFS

See [ipfs/README.md](ipfs/README.md) for IPFS deployment instructions.

### 4. Install Python Dependenices

See [cti/README.md](cti/README.md) for instructions on setting up a Python virtual environment and installing dependencies.

### 5. Set environment variables

Set the correct IP addresses for the services and Vault tokens as described above. You can check service IPs using:
```bash
kubectl get svc
```

---

## License

This repository is licensed under the MIT License, except for the `bevel-operator-fabric` directory and `cti/ctiTransfer.go`, which are licensed under the Apache License 2.0.

- See [`LICENSE`](./LICENSE) for the MIT License.
- See [`bevel-operator-fabric/LICENSE`](./bevel-operator-fabric/LICENSE) for the Apache License 2.0.
- Portions of `cti/ctiTransfer.go` are adapted from [Hyperledger Fabric samples](https://github.com/hyperledger/fabric-samples/blob/main/asset-transfer-basic/chaincode-external/assetTransfer.go).
