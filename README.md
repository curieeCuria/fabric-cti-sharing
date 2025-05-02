# CLI Usage

The `cli.py` script provides commands for creating and decrypting CTI.

### Sending CTI

To create and submit CTI metadata:

```bash
python cli.py create <filepath> <sender_identity> <description>
```

Example:

```bash
python cli.py create cti/sample_cti.json "Org1MSP" "Malicious URL"
```

### Receiving CTI

To query and decrypt CTI using its UUID:

```bash
python cli.py decrypt <uuid> <output (optional)>
```

If no output path is provided, the decrypted data will be printed to the console.

Example:

```bash
python cli.py decrypt 9c01dc9d-cc3f-4b9a-8240-ac8e5b12e431 decrypted_data.json
```


## License

This repository is licensed under the MIT License, except for the `bevel-operator-fabric` directory and `cti/ctiTransfer.go`, which are licensed under the Apache License 2.0.

- See [`LICENSE`](./LICENSE) for the MIT License.
- See [`bevel-operator-fabric/LICENSE`](./bevel-operator-fabric/LICENSE) for the Apache License 2.0.
- Portions of `cti/ctiTransfer.go` are adapted from [Hyperledger Fabric samples](https://github.com/hyperledger/fabric-samples/blob/main/asset-transfer-basic/chaincode-external/assetTransfer.go).