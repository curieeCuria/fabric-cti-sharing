## Create metadata file
```bash
rm code.tar.gz chaincode.tgz
export CHAINCODE_NAME=fabcar
export CHAINCODE_LABEL=fabcar
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
kubectl hlf externalchaincode sync --image=betoni/fabcar:latest \ # this image is built from fixtures/chaincodes/fabcar/external
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


## Invoke a transaction on the channel
```bash
kubectl hlf chaincode invoke --config=org1.yaml \
    --user=org1-admin-default --peer=org1-peer0.default \
    --chaincode=$CHAINCODE_NAME --channel=demo \
    --fcn=initLedger
```


## Query the chaincode
```bash
kubectl hlf chaincode query --config=org1.yaml \
    --user=org1-admin-default --peer=org1-peer0.default \
    --chaincode=$CHAINCODE_NAME --channel=demo \
    --fcn=queryAllCars
```


## Add a new car
```bash
kubectl hlf chaincode invoke --config=org1.yaml \
    --user=org1-admin-default --peer=org1-peer0.default \
    --chaincode=$CHAINCODE_NAME --channel=demo \
    --fcn=createCar -a "CAR10" -a "Tesla" -a "Model S" -a "Red" -a "Elon"
```


## Query a specific car
```bash
kubectl hlf chaincode query --config=org1.yaml \
    --user=org1-admin-default --peer=org1-peer0.default \
    --chaincode=$CHAINCODE_NAME --channel=demo \
    --fcn=queryCar -a "CAR10"
```