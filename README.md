# Fabric CTI Sharing

This repository contains tools and examples for sharing Cyber Threat Intelligence on a Hyperledger Fabric network.

## Server Setup

A minimal server is provided under the `server/` directory. The server expects a wallet directory to store identities used to access the network.

By default, the wallet is created at `server/wallet`. You can override this location by setting the `WALLET_PATH` environment variable before starting the server.

```bash
# Start the server with the default wallet path
npm --prefix server start

# Or specify a custom wallet location
WALLET_PATH=/path/to/wallet npm --prefix server start
```
