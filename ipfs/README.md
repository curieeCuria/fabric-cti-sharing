## Install IPFS-key (Linux amd64)
```bash
wget https://github.com/LasseRapo/ipfs-key/releases/download/v1.0/ipfs-key_1.0_linux_amd64.tar.gz
tar -xzf ipfs-key_1.0_linux_amd64.tar.gz
sudo mv ipfs-key_linux_amd64 /usr/local/bin/ipfs-key
```
Other platform binaries: https://github.com/LasseRapo/ipfs-key/releases

## Create `secret.yaml` with a script
You can use the following bash script to generate a `secret.yaml` file:

```bash
#!/bin/bash

cat <<EOF > secret.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: env-config
data:
  bootstrap-peer-id: <INSERT_ID_FOR_GENERATED_KEY>

---
apiVersion: v1
kind: Secret
metadata:
  name: secret-config
type: Opaque
data:
  cluster-secret: <INSERT_SECRET>
  bootstrap-peer-priv-key: <INSERT_KEY>
EOF

echo "secret.yaml created."
```

## Generate cluster secret
To generate the [cluster_secret](secret.yaml#L15) value in [secret.yaml](secret.yaml), run the following and insert the output to [cluster_secret](secret.yaml#L15):
```bash
od  -vN 32 -An -tx1 /dev/urandom | tr -d ' \n' | base64 -w 0 -
```

## Generate bootstrap peer ID and private key
To generate the values for [bootstrap_peer_id](secret.yaml#L6) and [bootstrap_peer_priv_key](secret.yaml#L16), run the following:
```bash
ipfs-key | base64 -w 0
```
Copy the ID for generated key to [bootstrap_peer_id](secret.yaml#L6).

Then copy the private key value and run the following with it:
```bash
echo "<INSERT_PRIV_KEY_VALUE_HERE>" | base64 -w 0 -
```
Copy the output to [bootstrap_peer_priv_key](secret.yaml#L16).

## Deploy IPFS
```bash
kubectl apply -f .
```

## Check secret-config
```bash
kubectl get secrets
```

## Check env-config & bootstrap-conf
```bash
kubectl get cm
```

## Check ipfs-cluster stateful set
```bash
kubectl get sts
```

## Check ipfs-cluster service IP
```bash
kubectl get svc
```

## Send request to ipfs service
```bash
curl http://172.20.0.3:9094/peers | jq . > peers.json
```

## Add file
```bash
curl -X POST -F file=@hello.txt http://172.20.0.2:9094/add
```

## Retrieve file
```bash
curl http://172.20.0.2:8080/ipfs/cid
```