# CLI Usage

The `cli.py` script provides commands for creating and decrypting CTI.

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

To create and submit CTI metadata:

```bash
python cli.py create <filepath> <description> <roles>
```

### Example

```bash
python cli.py create cti/sample_cti.json "Malicious URL" "HeadOfOperations,TacticalUnit"
```

## Receiving CTI

To query and decrypt CTI using its UUID:

```bash
python cli.py decrypt <uuid> <output (optional)>
```

If no output path is provided, the decrypted data will be printed to the console.

### Example

```bash
python cli.py decrypt 9c01dc9d-cc3f-4b9a-8240-ac8e5b12e431 decrypted_data.json
```


## License

This repository is licensed under the MIT License, except for the `bevel-operator-fabric` directory and `cti/ctiTransfer.go`, which are licensed under the Apache License 2.0.

- See [`LICENSE`](./LICENSE) for the MIT License.
- See [`bevel-operator-fabric/LICENSE`](./bevel-operator-fabric/LICENSE) for the Apache License 2.0.
- Portions of `cti/ctiTransfer.go` are adapted from [Hyperledger Fabric samples](https://github.com/hyperledger/fabric-samples/blob/main/asset-transfer-basic/chaincode-external/assetTransfer.go).