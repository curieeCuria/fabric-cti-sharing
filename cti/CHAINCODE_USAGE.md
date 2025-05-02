## Configure internal DNS
```bash
kubectl apply -f - <<EOF
kind: ConfigMap
apiVersion: v1
metadata:
  name: coredns
  namespace: kube-system
data:
  Corefile: |
    .:53 {
        errors
        health {
           lameduck 5s
        }
        rewrite name regex (.*)\.localho\.st istio-ingressgateway.istio-system.svc.cluster.local
        hosts {
          fallthrough
        }
        ready
        kubernetes cluster.local in-addr.arpa ip6.arpa {
           pods insecure
           fallthrough in-addr.arpa ip6.arpa
           ttl 30
        }
        prometheus :9153
        forward . /etc/resolv.conf {
           max_concurrent 1000
        }
        cache 30
        loop
        reload
        loadbalance
    }
EOF
```


## Fetch the connection string from the Kubernetes secret
```bash
kubectl get secret org1-cp -o jsonpath="{.data.config\.yaml}" | base64 --decode > org1.yaml
```


## Create metadata file
```bash
rm code.tar.gz chaincode.tgz
export CHAINCODE_NAME=ctitransfer104
export CHAINCODE_LABEL=ctitransfer104
cat << METADATA-EOF > "metadata.json"
{
    "type": "ccaas",
    "label": "${CHAINCODE_LABEL}"
}
METADATA-EOF
```


## Prepare connection file
```bash
cat > "connection.json" <<CONN_EOF
{
  "address": "${CHAINCODE_NAME}:7052",
  "dial_timeout": "10s",
  "tls_required": false
}
CONN_EOF

tar cfz code.tar.gz connection.json
tar cfz chaincode.tgz metadata.json code.tar.gz
export PACKAGE_ID=$(kubectl hlf chaincode calculatepackageid --path=chaincode.tgz --language=node --label=$CHAINCODE_LABEL)
echo "PACKAGE_ID=$PACKAGE_ID"

kubectl hlf chaincode install --path=./chaincode.tgz \
    --config=org1.yaml --language=golang --label=$CHAINCODE_LABEL --user=org1-admin-default --peer=org1-peer0.default

kubectl hlf chaincode install --path=./chaincode.tgz \
    --config=org1.yaml --language=golang --label=$CHAINCODE_LABEL --user=org1-admin-default --peer=org1-peer1.default
```


## Check if the chaincode is installed
```bash
kubectl hlf chaincode queryinstalled --config=org1.yaml --user=org1-admin-default --peer=org1-peer0.default
```


## Deploy chaincode container on cluster
```bash
kubectl hlf externalchaincode sync --image=betoni/cti-transfer:v1.0.4 \
    --name=$CHAINCODE_NAME \
    --namespace=default \
    --package-id=$PACKAGE_ID \
    --tls-required=false \
    --replicas=1
```


## Approve chaincode
```bash
export SEQUENCE=1
export VERSION="1.0"
kubectl hlf chaincode approveformyorg --config=org1.yaml --user=org1-admin-default --peer=org1-peer0.default \
    --package-id=$PACKAGE_ID \
    --version "$VERSION" --sequence "$SEQUENCE" --name=$CHAINCODE_NAME \
    --policy="OR('Org1MSP.member')" --channel=demo
```


## Commit chaincode
```bash
kubectl hlf chaincode commit --config=org1.yaml --user=org1-admin-default --mspid=Org1MSP \
    --version "$VERSION" --sequence "$SEQUENCE" --name=$CHAINCODE_NAME \
    --policy="OR('Org1MSP.member')" --channel=demo
```


## Initialize the chaincode with sample CTI metadata
```bash
kubectl hlf chaincode invoke --config=org1.yaml \
    --user=org1-admin-default --peer=org1-peer0.default \
    --chaincode=$CHAINCODE_NAME --channel=demo \
    --fcn=initLedger
```


## Query all CTI metadata
```bash
kubectl hlf chaincode invoke --config=org1.yaml \
    --user=org1-admin-default --peer=org1-peer0.default \
    --chaincode=$CHAINCODE_NAME --channel=demo \
    --fcn=GetAllCTI
```


## Add new CTI metadata
```bash
kubectl hlf chaincode invoke --config=org1.yaml \
    --user=org1-admin-default --peer=org1-peer0.default \
    --chaincode=$CHAINCODE_NAME --channel=demo \
    --fcn=CreateCTIMetadata \
    --args="{\"UUID\":\"55555\",\"Description\":\"Example metadata 5555\",\"Timestamp\":\"2025-04-30T12:00:00Z\",\"SenderIdentity\":\"user5\",\"CID\":\"CID5555\",\"VaultKey\":\"vaultKey5555\",\"SHA256Hash\":\"sha256hash5555\"}"
```


## Query CTI metadata by its UUID
```bash
kubectl hlf chaincode invoke --config=org1.yaml \
    --user=org1-admin-default --peer=org1-peer0.default \
    --chaincode=$CHAINCODE_NAME --channel=demo \
    --fcn=ReadCTIMetadata \
    --args="55555"
```


## Update an existing CTI metadata entry
```bash
kubectl hlf chaincode invoke --config=org1.yaml \
    --user=org1-admin-default --peer=org1-peer0.default \
    --chaincode=$CHAINCODE_NAME --channel=demo \
    --fcn=UpdateCTIMetadata \
    --args="{\"UUID\":\"12345\",\"Description\":\"Updated metadata entry 12345\",\"Timestamp\":\"2025-05-01T12:00:00Z\",\"SenderIdentity\":\"user1\",\"CID\":\"CID12345-updated\",\"VaultKey\":\"vaultKey12345-updated\",\"SHA256Hash\":\"sha256hash12345-updated\"}"
```


## Delete CTI metadata by its UUID
```bash
kubectl hlf chaincode invoke --config=org1.yaml \
    --user=org1-admin-default --peer=org1-peer0.default \
    --chaincode=$CHAINCODE_NAME --channel=demo \
    --fcn=DeleteCTIMetadata \
    --args="12345"
```