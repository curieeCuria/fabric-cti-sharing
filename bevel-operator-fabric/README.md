# ENSURE THAT YOU ARE IN THE BEVEL-OPERATOR-FABRIC DIRECTORY BEFORE RUNNING THE COMMANDS

## Create cluster
```bash
k3d cluster create  -p "80:30949@agent:0" -p "443:30950@agent:0" --agents 2 k8s-hlf
```


## Deploy istio
```bash
kubectl create namespace istio-system

export ISTIO_PATH=$(echo $PWD/istio-*/bin)
export PATH="$PATH:$ISTIO_PATH"

istioctl operator init

kubectl apply -f - <<EOF
apiVersion: install.istio.io/v1alpha1
kind: IstioOperator
metadata:
  name: istio-gateway
  namespace: istio-system
spec:
  addonComponents:
    grafana:
      enabled: true
    kiali:
      enabled: false
    prometheus:
      enabled: true
    tracing:
      enabled: false
  components:
    ingressGateways:
      - enabled: true
        k8s:
          hpaSpec:
            minReplicas: 1
          resources:
            limits:
              cpu: 500m
              memory: 512Mi
            requests:
              cpu: 100m
              memory: 128Mi
          service:
            ports:
              - name: http
                port: 80
                targetPort: 8080
                nodePort: 30949
              - name: https
                port: 443
                targetPort: 8443
                nodePort: 30950
            type: NodePort
        name: istio-ingressgateway
    pilot:
      enabled: true
      k8s:
        hpaSpec:
          minReplicas: 1
        resources:
          limits:
            cpu: 300m
            memory: 512Mi
          requests:
            cpu: 100m
            memory: 128Mi
  meshConfig:
    accessLogFile: /dev/stdout
    enableTracing: false
    outboundTrafficPolicy:
      mode: ALLOW_ANY
  profile: default

EOF
```


## Configure internal DNS (always run on restart)
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

## Install Prometheus and Grafana

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
```
```bash
helm repo update
```
```bash
helm install prometheus prometheus-community/kube-prometheus-stack --namespace monitoring --create-namespace
```

## Install Hyperledger Fabric Operator
```bash
helm repo add kfs https://kfsoftware.github.io/hlf-helm-charts --force-update

helm upgrade --install hlf-operator kfs/hlf-operator \
  --namespace default \
  --set serviceMonitor.enabled=true
```


## Install the Kubectl plugin
```bash
kubectl krew install hlf
```


## Peer organization env variables
```bash
export PEER_IMAGE=hyperledger/fabric-peer
export PEER_VERSION=3.0.0

export ORDERER_IMAGE=hyperledger/fabric-orderer
export ORDERER_VERSION=3.0.0

export CA_IMAGE=hyperledger/fabric-ca
export CA_VERSION=1.5.13

export STORAGE_CLASS=local-path # k3d storage class, "standard" for KinD
```


## Deploy CA for Org1
```bash
kubectl hlf ca create  --image=$CA_IMAGE --version=$CA_VERSION --storage-class=$STORAGE_CLASS --capacity=1Gi --name=org1-ca \
    --enroll-id=enroll --enroll-pw=enrollpw --hosts=org1-ca.localho.st --istio-port=443

kubectl wait --timeout=180s --for=condition=Running fabriccas.hlf.kungfusoftware.es --all
```

## Deploy CA for Org2
```bash
kubectl hlf ca create  --image=$CA_IMAGE --version=$CA_VERSION --storage-class=$STORAGE_CLASS --capacity=1Gi --name=org2-ca \
    --enroll-id=enroll --enroll-pw=enrollpw --hosts=org2-ca.localho.st --istio-port=443

kubectl wait --timeout=180s --for=condition=Running fabriccas.hlf.kungfusoftware.es --all
```

## Deploy CA for Org3
```bash
kubectl hlf ca create  --image=$CA_IMAGE --version=$CA_VERSION --storage-class=$STORAGE_CLASS --capacity=1Gi --name=org3-ca \
    --enroll-id=enroll --enroll-pw=enrollpw --hosts=org3-ca.localho.st --istio-port=443

kubectl wait --timeout=180s --for=condition=Running fabriccas.hlf.kungfusoftware.es --all
```

## Deploy CA for Org4
```bash
kubectl hlf ca create  --image=$CA_IMAGE --version=$CA_VERSION --storage-class=$STORAGE_CLASS --capacity=1Gi --name=org4-ca \
    --enroll-id=enroll --enroll-pw=enrollpw --hosts=org4-ca.localho.st --istio-port=443

kubectl wait --timeout=180s --for=condition=Running fabriccas.hlf.kungfusoftware.es --all
```


## Check certificate authority
```bash
curl -k https://org1-ca.localho.st:443/cainfo
```


## Register a user in the certification authority of Org1MSP
```bash
kubectl hlf ca register --name=org1-ca --user=peer --secret=peerpw --type=peer \
 --enroll-id enroll --enroll-secret=enrollpw --mspid Org1MSP \
 --attributes="role=HeadOfOperations"
```

## Register a user in the certification authority of Org2MSP
```bash
kubectl hlf ca register --name=org2-ca --user=peer --secret=peerpw --type=peer \
 --enroll-id enroll --enroll-secret=enrollpw --mspid Org2MSP \
 --attributes="role=IntelligenceUnit"
```

## Register a user in the certification authority of Org3MSP
```bash
kubectl hlf ca register --name=org3-ca --user=peer --secret=peerpw --type=peer \
 --enroll-id enroll --enroll-secret=enrollpw --mspid Org3MSP \
 --attributes="role=TacticalUnit"
```

## Register a user in the certification authority of Org4MSP
```bash
kubectl hlf ca register --name=org4-ca --user=peer --secret=peerpw --type=peer \
 --enroll-id enroll --enroll-secret=enrollpw --mspid Org4MSP \
 --attributes="role=SpecialOperationsUnit"
```


## Deploy Org1 peers
```bash
kubectl hlf peer create --statedb=leveldb --image=$PEER_IMAGE --version=$PEER_VERSION --storage-class=$STORAGE_CLASS --enroll-id=peer --mspid=Org1MSP \
        --enroll-pw=peerpw --capacity=10Gi --name=org1-peer0 --ca-name=org1-ca.default \
        --hosts=peer0-org1.localho.st --istio-port=443


kubectl hlf peer create --statedb=leveldb --image=$PEER_IMAGE --version=$PEER_VERSION --storage-class=$STORAGE_CLASS --enroll-id=peer --mspid=Org1MSP \
        --enroll-pw=peerpw --capacity=10Gi --name=org1-peer1 --ca-name=org1-ca.default \
        --hosts=peer1-org1.localho.st --istio-port=443


kubectl wait --timeout=180s --for=condition=Running fabricpeers.hlf.kungfusoftware.es --all
```

## Deploy Org2 peers
```bash
kubectl hlf peer create --statedb=leveldb --image=$PEER_IMAGE --version=$PEER_VERSION --storage-class=$STORAGE_CLASS --enroll-id=peer --mspid=Org2MSP \
        --enroll-pw=peerpw --capacity=10Gi --name=org2-peer0 --ca-name=org2-ca.default \
        --hosts=peer0-org2.localho.st --istio-port=443


kubectl hlf peer create --statedb=leveldb --image=$PEER_IMAGE --version=$PEER_VERSION --storage-class=$STORAGE_CLASS --enroll-id=peer --mspid=Org2MSP \
        --enroll-pw=peerpw --capacity=10Gi --name=org2-peer1 --ca-name=org2-ca.default \
        --hosts=peer1-org2.localho.st --istio-port=443


kubectl wait --timeout=180s --for=condition=Running fabricpeers.hlf.kungfusoftware.es --all
```

## Deploy Org3 peers
```bash
kubectl hlf peer create --statedb=leveldb --image=$PEER_IMAGE --version=$PEER_VERSION --storage-class=$STORAGE_CLASS --enroll-id=peer --mspid=Org3MSP \
        --enroll-pw=peerpw --capacity=10Gi --name=org3-peer0 --ca-name=org3-ca.default \
        --hosts=peer0-org3.localho.st --istio-port=443


kubectl hlf peer create --statedb=leveldb --image=$PEER_IMAGE --version=$PEER_VERSION --storage-class=$STORAGE_CLASS --enroll-id=peer --mspid=Org3MSP \
        --enroll-pw=peerpw --capacity=10Gi --name=org3-peer1 --ca-name=org3-ca.default \
        --hosts=peer1-org3.localho.st --istio-port=443


kubectl wait --timeout=180s --for=condition=Running fabricpeers.hlf.kungfusoftware.es --all
```

## Deploy Org4 peers
```bash
kubectl hlf peer create --statedb=leveldb --image=$PEER_IMAGE --version=$PEER_VERSION --storage-class=$STORAGE_CLASS --enroll-id=peer --mspid=Org4MSP \
        --enroll-pw=peerpw --capacity=10Gi --name=org4-peer0 --ca-name=org4-ca.default \
        --hosts=peer0-org4.localho.st --istio-port=443


kubectl hlf peer create --statedb=leveldb --image=$PEER_IMAGE --version=$PEER_VERSION --storage-class=$STORAGE_CLASS --enroll-id=peer --mspid=Org4MSP \
        --enroll-pw=peerpw --capacity=10Gi --name=org4-peer1 --ca-name=org4-ca.default \
        --hosts=peer1-org4.localho.st --istio-port=443


kubectl wait --timeout=180s --for=condition=Running fabricpeers.hlf.kungfusoftware.es --all
```


## Check peers
```bash
openssl s_client -connect peer0-org1.localho.st:443
openssl s_client -connect peer1-org1.localho.st:443
```
```bash
openssl s_client -connect peer0-org2.localho.st:443
openssl s_client -connect peer1-org2.localho.st:443
```
```bash
openssl s_client -connect peer0-org3.localho.st:443
openssl s_client -connect peer1-org3.localho.st:443
```
```bash
openssl s_client -connect peer0-org4.localho.st:443
openssl s_client -connect peer1-org4.localho.st:443
```


## Deploy a certificate authority for orderer organization
```bash
kubectl hlf ca create  --image=$CA_IMAGE --version=$CA_VERSION --storage-class=$STORAGE_CLASS --capacity=1Gi --name=ord-ca \
    --enroll-id=enroll --enroll-pw=enrollpw --hosts=ord-ca.localho.st --istio-port=443

kubectl wait --timeout=180s --for=condition=Running fabriccas.hlf.kungfusoftware.es --all
```


## Check certificate authority
```bash
curl -vik https://ord-ca.localho.st:443/cainfo
```


## Register user orderer
```bash
kubectl hlf ca register --name=ord-ca --user=orderer --secret=ordererpw \
    --type=orderer --enroll-id enroll --enroll-secret=enrollpw --mspid=OrdererMSP --ca-url="https://ord-ca.localho.st:443"
```


## Deploy orderer
```bash
kubectl hlf ordnode create --image=$ORDERER_IMAGE --version=$ORDERER_VERSION \
    --storage-class=$STORAGE_CLASS --enroll-id=orderer --mspid=OrdererMSP \
    --enroll-pw=ordererpw --capacity=4Gi --name=ord-node1 --ca-name=ord-ca.default \
    --hosts=orderer0-ord.localho.st --admin-hosts=admin-orderer0-ord.localho.st --istio-port=443


kubectl hlf ordnode create --image=$ORDERER_IMAGE --version=$ORDERER_VERSION \
    --storage-class=$STORAGE_CLASS --enroll-id=orderer --mspid=OrdererMSP \
    --enroll-pw=ordererpw --capacity=4Gi --name=ord-node2 --ca-name=ord-ca.default \
    --hosts=orderer1-ord.localho.st --admin-hosts=admin-orderer1-ord.localho.st --istio-port=443

kubectl hlf ordnode create --image=$ORDERER_IMAGE --version=$ORDERER_VERSION \
    --storage-class=$STORAGE_CLASS --enroll-id=orderer --mspid=OrdererMSP \
    --enroll-pw=ordererpw --capacity=4Gi --name=ord-node3 --ca-name=ord-ca.default \
    --hosts=orderer2-ord.localho.st --admin-hosts=admin-orderer2-ord.localho.st --istio-port=443


kubectl hlf ordnode create --image=$ORDERER_IMAGE --version=$ORDERER_VERSION \
    --storage-class=$STORAGE_CLASS --enroll-id=orderer --mspid=OrdererMSP \
    --enroll-pw=ordererpw --capacity=4Gi --name=ord-node4 --ca-name=ord-ca.default \
    --hosts=orderer3-ord.localho.st --admin-hosts=admin-orderer3-ord.localho.st --istio-port=443

# 3/4 for BFT

kubectl wait --timeout=180s --for=condition=Running fabricorderernodes.hlf.kungfusoftware.es --all
```


## Check orderer
```bash
kubectl get pods
```
```bash
openssl s_client -connect orderer0-ord.localho.st:443
```


## Register and enroll OrdererMSP identity
```bash
# register
kubectl hlf ca register --name=ord-ca --user=admin --secret=adminpw \
    --type=admin --enroll-id enroll --enroll-secret=enrollpw --mspid=OrdererMSP

# enroll
kubectl hlf ca enroll --name=ord-ca --namespace=default \
    --user=admin --secret=adminpw --mspid OrdererMSP \
    --ca-name tlsca  --output ../cti/resources/orderermsp.yaml
    
kubectl hlf ca enroll --name=ord-ca --namespace=default \
    --user=admin --secret=adminpw --mspid OrdererMSP \
    --ca-name ca  --output ../cti/resources/orderermspsign.yaml
```

## Register and enroll Org1MSP identity
```bash
# Register
kubectl hlf ca register --name=org1-ca --namespace=default --user=admin --secret=adminpw \
    --type=admin --enroll-id enroll --enroll-secret=enrollpw --mspid=Org1MSP \
    --attributes="role=HeadOfOperations"

# Enroll
kubectl hlf ca enroll --name=org1-ca --namespace=default \
    --user=admin --secret=adminpw --mspid=Org1MSP \
    --ca-name ca --output ../cti/resources/org1msp.yaml \
    --attributes="hf.Affiliation,hf.EnrollmentID,hf.Type,role"
```

## Register and enroll Org2MSP identity
```bash
# Register
kubectl hlf ca register --name=org2-ca --namespace=default --user=admin --secret=adminpw \
    --type=admin --enroll-id enroll --enroll-secret=enrollpw --mspid=Org2MSP \
    --attributes="role=IntelligenceUnit"

# Enroll
kubectl hlf ca enroll --name=org2-ca --namespace=default \
    --user=admin --secret=adminpw --mspid=Org2MSP \
    --ca-name ca --output ../cti/resources/org2msp.yaml \
    --attributes="hf.Affiliation,hf.EnrollmentID,hf.Type,role"
```

## Register and enroll Org3MSP identity
```bash
# Register
kubectl hlf ca register --name=org3-ca --namespace=default --user=admin --secret=adminpw \
    --type=admin --enroll-id enroll --enroll-secret=enrollpw --mspid=Org3MSP \
    --attributes="role=TacticalUnit"

# Enroll
kubectl hlf ca enroll --name=org3-ca --namespace=default \
    --user=admin --secret=adminpw --mspid=Org3MSP \
    --ca-name ca --output ../cti/resources/org3msp.yaml \
    --attributes="hf.Affiliation,hf.EnrollmentID,hf.Type,role"
```

## Register and enroll Org4MSP identity
```bash
# Register
kubectl hlf ca register --name=org4-ca --namespace=default --user=admin --secret=adminpw \
    --type=admin --enroll-id enroll --enroll-secret=enrollpw --mspid=Org4MSP \
    --attributes="role=SpecialOperationsUnit"

# Enroll
kubectl hlf ca enroll --name=org4-ca --namespace=default \
    --user=admin --secret=adminpw --mspid=Org4MSP \
    --ca-name ca --output ../cti/resources/org4msp.yaml \
    --attributes="hf.Affiliation,hf.EnrollmentID,hf.Type,role"
```

## Create secret wallet
```bash
kubectl create secret generic wallet --namespace=default \
    --from-file=org1msp.yaml=$PWD/../cti/resources/org1msp.yaml \
    --from-file=org2msp.yaml=$PWD/../cti/resources/org2msp.yaml \
    --from-file=org3msp.yaml=$PWD/../cti/resources/org3msp.yaml \
    --from-file=org4msp.yaml=$PWD/../cti/resources/org4msp.yaml \
    --from-file=orderermsp.yaml=$PWD/../cti/resources/orderermsp.yaml \
    --from-file=orderermspsign.yaml=$PWD/../cti/resources/orderermspsign.yaml
```

## Create main channel
```bash
export IDENT_12=$(printf "%16s" "")
# tls CA certificate
export ORDERER_TLS_CERT=$(kubectl get fabriccas ord-ca -o=jsonpath='{.status.tlsca_cert}' | sed -e "s/^/${IDENT_12}/" )

export ORDERER0_TLS_CERT=$(kubectl get fabricorderernodes ord-node1 -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_12}/" )
export ORDERER1_TLS_CERT=$(kubectl get fabricorderernodes ord-node2 -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_12}/" )
export ORDERER2_TLS_CERT=$(kubectl get fabricorderernodes ord-node3 -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_12}/" )
export ORDERER3_TLS_CERT=$(kubectl get fabricorderernodes ord-node4 -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_12}/" )

export ORDERER0_SIGN_CERT=$(kubectl get fabricorderernodes ord-node1 -o=jsonpath='{.status.signCert}' | sed -e "s/^/${IDENT_12}/" )
export ORDERER1_SIGN_CERT=$(kubectl get fabricorderernodes ord-node2 -o=jsonpath='{.status.signCert}' | sed -e "s/^/${IDENT_12}/" )
export ORDERER2_SIGN_CERT=$(kubectl get fabricorderernodes ord-node3 -o=jsonpath='{.status.signCert}' | sed -e "s/^/${IDENT_12}/" )
export ORDERER3_SIGN_CERT=$(kubectl get fabricorderernodes ord-node4 -o=jsonpath='{.status.signCert}' | sed -e "s/^/${IDENT_12}/" )

kubectl apply -f - <<EOF
apiVersion: hlf.kungfusoftware.es/v1alpha1
kind: FabricMainChannel
metadata:
  name: main
spec:
  name: main
  adminOrdererOrganizations:
    - mspID: OrdererMSP
  adminPeerOrganizations:
    - mspID: Org1MSP
  channelConfig:
    application:
      acls: null
      capabilities:
        - V2_5
      policies: null
    capabilities:
      - V3_0
    orderer:
      batchSize:
        absoluteMaxBytes: 1048576
        maxMessageCount: 100
        preferredMaxBytes: 524288
      batchTimeout: 2s
      capabilities:
        - V2_0
      smartBFT:
        request_batch_max_count: 100
        request_batch_max_bytes: 10485760
        request_batch_max_interval: "50ms"
        incoming_message_buffer_size: 200
        request_pool_size: 100000
        request_forward_timeout: "2s"
        request_complain_timeout: "20s"
        request_auto_remove_timeout: "3m"
        view_change_resend_interval: "5s"
        view_change_timeout: "20s"
        leader_heartbeat_timeout: "1m0s"
        leader_heartbeat_count: 10
        collect_timeout: "1s"
        sync_on_start: true
        speed_up_view_change: false
        leader_rotation: 0 # unspecified
        decisions_per_leader: 3
        request_max_bytes: 0

      consenterMapping:
      - host: orderer0-ord.localho.st
        port: 443
        id: 1
        msp_id: OrdererMSP
        client_tls_cert: |
${ORDERER0_TLS_CERT}

        server_tls_cert: |
${ORDERER0_TLS_CERT}

        identity: |
${ORDERER0_SIGN_CERT}

      - host: orderer1-ord.localho.st
        port: 443
        id: 2
        msp_id: OrdererMSP
        client_tls_cert: |
${ORDERER1_TLS_CERT}

        server_tls_cert: |
${ORDERER1_TLS_CERT}

        identity: |
${ORDERER1_SIGN_CERT}

      - host: orderer2-ord.localho.st
        port: 443
        id: 3
        msp_id: OrdererMSP
        client_tls_cert: |
${ORDERER2_TLS_CERT}

        server_tls_cert: |
${ORDERER2_TLS_CERT}

        identity: |
${ORDERER2_SIGN_CERT}

      - host: orderer3-ord.localho.st
        port: 443
        id: 4
        msp_id: OrdererMSP
        client_tls_cert: |
${ORDERER3_TLS_CERT}

        server_tls_cert: |
${ORDERER3_TLS_CERT}

        identity: |
${ORDERER3_SIGN_CERT}

      ordererType: BFT
      policies: null
      state: STATE_NORMAL
    policies: null
  externalOrdererOrganizations: []
  peerOrganizations:
    - mspID: Org1MSP
      caName: "org1-ca"
      caNamespace: "default"
    - mspID: Org2MSP
      caName: "org2-ca"
      caNamespace: "default"
    - mspID: Org3MSP
      caName: "org3-ca"
      caNamespace: "default"
    - mspID: Org4MSP
      caName: "org4-ca"
      caNamespace: "default"
  identities:
    OrdererMSP:
      secretKey: orderermsp.yaml
      secretName: wallet
      secretNamespace: default
    OrdererMSP-tls:
      secretKey: orderermsp.yaml
      secretName: wallet
      secretNamespace: default
    OrdererMSP-sign:
      secretKey: orderermspsign.yaml
      secretName: wallet
      secretNamespace: default
    Org1MSP:
      secretKey: org1msp.yaml
      secretName: wallet
      secretNamespace: default
  externalPeerOrganizations: []
  ordererOrganizations:
    - caName: "ord-ca"
      caNamespace: "default"
      externalOrderersToJoin:
        - host: ord-node1
          port: 7053
        - host: ord-node2
          port: 7053
        - host: ord-node3
          port: 7053
        - host: ord-node4
          port: 7053
      mspID: OrdererMSP
      ordererEndpoints:
        - orderer0-ord.localho.st:443
        - orderer1-ord.localho.st:443
        - orderer2-ord.localho.st:443
        - orderer3-ord.localho.st:443
      orderersToJoin: []
  orderers:
    - host: ord-node1
      port: 7050
      tlsCert: |
${ORDERER0_TLS_CERT}
    - host: ord-node2
      port: 7050
      tlsCert: |-
${ORDERER1_TLS_CERT}
    - host: ord-node3
      port: 7050
      tlsCert: |-
${ORDERER2_TLS_CERT}
    - host: ord-node4
      port: 7050
      tlsCert: |-
${ORDERER2_TLS_CERT}

EOF
```


## Join peer to the main channel - Org1MSP
```bash
export IDENT_8=$(printf "%8s" "")
export ORDERER0_TLS_CERT=$(kubectl get fabricorderernodes ord-node1 -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_8}/" )

kubectl apply -f - <<EOF
apiVersion: hlf.kungfusoftware.es/v1alpha1
kind: FabricFollowerChannel
metadata:
  name: main-org1msp
spec:
  anchorPeers:
    - host: org1-peer0.default
      port: 7051
    - host: org1-peer1.default
      port: 7051
  hlfIdentity:
    secretKey: org1msp.yaml
    secretName: wallet
    secretNamespace: default
  mspId: Org1MSP
  name: main
  externalPeersToJoin: []
  orderers:
    - certificate: |
${ORDERER0_TLS_CERT}
      url: grpcs://ord-node1.default:7050
  peersToJoin:
    - name: org1-peer0
      namespace: default
    - name: org1-peer1
      namespace: default
EOF
```

## Join peer to the main channel - Org2MSP
```bash
export IDENT_8=$(printf "%8s" "")
export ORDERER0_TLS_CERT=$(kubectl get fabricorderernodes ord-node1 -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_8}/" )

kubectl apply -f - <<EOF
apiVersion: hlf.kungfusoftware.es/v1alpha1
kind: FabricFollowerChannel
metadata:
  name: main-org2msp
spec:
  anchorPeers:
    - host: org2-peer0.default
      port: 7051
    - host: org2-peer1.default
      port: 7051
  hlfIdentity:
    secretKey: org2msp.yaml
    secretName: wallet
    secretNamespace: default
  mspId: Org2MSP
  name: main
  externalPeersToJoin: []
  orderers:
    - certificate: |
${ORDERER0_TLS_CERT}
      url: grpcs://ord-node1.default:7050
  peersToJoin:
    - name: org2-peer0
      namespace: default
    - name: org2-peer1
      namespace: default
EOF
```

## Join peer to the main channel - Org3MSP
```bash
export IDENT_8=$(printf "%8s" "")
export ORDERER0_TLS_CERT=$(kubectl get fabricorderernodes ord-node1 -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_8}/" )

kubectl apply -f - <<EOF
apiVersion: hlf.kungfusoftware.es/v1alpha1
kind: FabricFollowerChannel
metadata:
  name: main-org3msp
spec:
  anchorPeers:
    - host: org3-peer0.default
      port: 7051
    - host: org3-peer1.default
      port: 7051
  hlfIdentity:
    secretKey: org3msp.yaml
    secretName: wallet
    secretNamespace: default
  mspId: Org3MSP
  name: main
  externalPeersToJoin: []
  orderers:
    - certificate: |
${ORDERER0_TLS_CERT}
      url: grpcs://ord-node1.default:7050
  peersToJoin:
    - name: org3-peer0
      namespace: default
    - name: org3-peer1
      namespace: default
EOF
```

## Join peer to the main channel - Org4MSP
```bash
export IDENT_8=$(printf "%8s" "")
export ORDERER0_TLS_CERT=$(kubectl get fabricorderernodes ord-node1 -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_8}/" )

kubectl apply -f - <<EOF
apiVersion: hlf.kungfusoftware.es/v1alpha1
kind: FabricFollowerChannel
metadata:
  name: main-org4msp
spec:
  anchorPeers:
    - host: org4-peer0.default
      port: 7051
    - host: org4-peer1.default
      port: 7051
  hlfIdentity:
    secretKey: org4msp.yaml
    secretName: wallet
    secretNamespace: default
  mspId: Org4MSP
  name: main
  externalPeersToJoin: []
  orderers:
    - certificate: |
${ORDERER0_TLS_CERT}
      url: grpcs://ord-node1.default:7050
  peersToJoin:
    - name: org4-peer0
      namespace: default
    - name: org4-peer1
      namespace: default
EOF
```

### For chaincode deployment, see [CHAINCODE_USAGE.md](../cti/CHAINCODE_USAGE.md)


## Create private channel
```bash
export IDENT_12=$(printf "%16s" "")
# tls CA certificate
export ORDERER_TLS_CERT=$(kubectl get fabriccas ord-ca -o=jsonpath='{.status.tlsca_cert}' | sed -e "s/^/${IDENT_12}/" )

export ORDERER0_TLS_CERT=$(kubectl get fabricorderernodes ord-node1 -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_12}/" )
export ORDERER1_TLS_CERT=$(kubectl get fabricorderernodes ord-node2 -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_12}/" )
export ORDERER2_TLS_CERT=$(kubectl get fabricorderernodes ord-node3 -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_12}/" )
export ORDERER3_TLS_CERT=$(kubectl get fabricorderernodes ord-node4 -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_12}/" )

export ORDERER0_SIGN_CERT=$(kubectl get fabricorderernodes ord-node1 -o=jsonpath='{.status.signCert}' | sed -e "s/^/${IDENT_12}/" )
export ORDERER1_SIGN_CERT=$(kubectl get fabricorderernodes ord-node2 -o=jsonpath='{.status.signCert}' | sed -e "s/^/${IDENT_12}/" )
export ORDERER2_SIGN_CERT=$(kubectl get fabricorderernodes ord-node3 -o=jsonpath='{.status.signCert}' | sed -e "s/^/${IDENT_12}/" )
export ORDERER3_SIGN_CERT=$(kubectl get fabricorderernodes ord-node4 -o=jsonpath='{.status.signCert}' | sed -e "s/^/${IDENT_12}/" )

kubectl apply -f - <<EOF
apiVersion: hlf.kungfusoftware.es/v1alpha1
kind: FabricMainChannel
metadata:
  name: private
spec:
  name: private
  adminOrdererOrganizations:
    - mspID: OrdererMSP
  adminPeerOrganizations:
    - mspID: Org1MSP
    - mspID: Org4MSP
  channelConfig:
    application:
      acls: null
      capabilities:
        - V2_5
      policies: null
    capabilities:
      - V3_0
    orderer:
      batchSize:
        absoluteMaxBytes: 1048576
        maxMessageCount: 100
        preferredMaxBytes: 524288
      batchTimeout: 2s
      capabilities:
        - V2_0
      smartBFT:
        request_batch_max_count: 100
        request_batch_max_bytes: 10485760
        request_batch_max_interval: "50ms"
        incoming_message_buffer_size: 200
        request_pool_size: 100000
        request_forward_timeout: "2s"
        request_complain_timeout: "20s"
        request_auto_remove_timeout: "3m"
        view_change_resend_interval: "5s"
        view_change_timeout: "20s"
        leader_heartbeat_timeout: "1m0s"
        leader_heartbeat_count: 10
        collect_timeout: "1s"
        sync_on_start: true
        speed_up_view_change: false
        leader_rotation: 0 # unspecified
        decisions_per_leader: 3
        request_max_bytes: 0

      consenterMapping:
      - host: orderer0-ord.localho.st
        port: 443
        id: 1
        msp_id: OrdererMSP
        client_tls_cert: |
${ORDERER0_TLS_CERT}

        server_tls_cert: |
${ORDERER0_TLS_CERT}

        identity: |
${ORDERER0_SIGN_CERT}

      - host: orderer1-ord.localho.st
        port: 443
        id: 2
        msp_id: OrdererMSP
        client_tls_cert: |
${ORDERER1_TLS_CERT}

        server_tls_cert: |
${ORDERER1_TLS_CERT}

        identity: |
${ORDERER1_SIGN_CERT}

      - host: orderer2-ord.localho.st
        port: 443
        id: 3
        msp_id: OrdererMSP
        client_tls_cert: |
${ORDERER2_TLS_CERT}

        server_tls_cert: |
${ORDERER2_TLS_CERT}

        identity: |
${ORDERER2_SIGN_CERT}

      - host: orderer3-ord.localho.st
        port: 443
        id: 4
        msp_id: OrdererMSP
        client_tls_cert: |
${ORDERER3_TLS_CERT}

        server_tls_cert: |
${ORDERER3_TLS_CERT}

        identity: |
${ORDERER3_SIGN_CERT}

      ordererType: BFT
      policies: null
      state: STATE_NORMAL
    policies: null
  externalOrdererOrganizations: []
  peerOrganizations:
    - mspID: Org1MSP
      caName: "org1-ca"
      caNamespace: "default"
    - mspID: Org4MSP
      caName: "org4-ca"
      caNamespace: "default"
  identities:
    OrdererMSP:
      secretKey: orderermsp.yaml
      secretName: wallet
      secretNamespace: default
    OrdererMSP-tls:
      secretKey: orderermsp.yaml
      secretName: wallet
      secretNamespace: default
    OrdererMSP-sign:
      secretKey: orderermspsign.yaml
      secretName: wallet
      secretNamespace: default
    Org1MSP:
      secretKey: org1msp.yaml
      secretName: wallet
      secretNamespace: default
    Org4MSP:
      secretKey: org4msp.yaml
      secretName: wallet
      secretNamespace: default
  externalPeerOrganizations: []
  ordererOrganizations:
    - caName: "ord-ca"
      caNamespace: "default"
      externalOrderersToJoin:
        - host: ord-node1
          port: 7053
        - host: ord-node2
          port: 7053
        - host: ord-node3
          port: 7053
        - host: ord-node4
          port: 7053
      mspID: OrdererMSP
      ordererEndpoints:
        - orderer0-ord.localho.st:443
        - orderer1-ord.localho.st:443
        - orderer2-ord.localho.st:443
        - orderer3-ord.localho.st:443
      orderersToJoin: []
  orderers:
    - host: ord-node1
      port: 7050
      tlsCert: |
${ORDERER0_TLS_CERT}
    - host: ord-node2
      port: 7050
      tlsCert: |-
${ORDERER1_TLS_CERT}
    - host: ord-node3
      port: 7050
      tlsCert: |-
${ORDERER2_TLS_CERT}
    - host: ord-node4
      port: 7050
      tlsCert: |-
${ORDERER2_TLS_CERT}

EOF
```

## Join peer to the private channel - Org1MSP
```bash
export IDENT_8=$(printf "%8s" "")
export ORDERER0_TLS_CERT=$(kubectl get fabricorderernodes ord-node1 -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_8}/" )

kubectl apply -f - <<EOF
apiVersion: hlf.kungfusoftware.es/v1alpha1
kind: FabricFollowerChannel
metadata:
  name: private-org1msp
spec:
  anchorPeers:
    - host: org1-peer0.default
      port: 7051
    - host: org1-peer1.default
      port: 7051
  hlfIdentity:
    secretKey: org1msp.yaml
    secretName: wallet
    secretNamespace: default
  mspId: Org1MSP
  name: private
  externalPeersToJoin: []
  orderers:
    - certificate: |
${ORDERER0_TLS_CERT}
      url: grpcs://ord-node1.default:7050
  peersToJoin:
    - name: org1-peer0
      namespace: default
    - name: org1-peer1
      namespace: default
EOF
```

## Join peer to the private channel - Org4MSP
```bash
export IDENT_8=$(printf "%8s" "")
export ORDERER0_TLS_CERT=$(kubectl get fabricorderernodes ord-node1 -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_8}/" )

kubectl apply -f - <<EOF
apiVersion: hlf.kungfusoftware.es/v1alpha1
kind: FabricFollowerChannel
metadata:
  name: private-org4msp
spec:
  anchorPeers:
    - host: org4-peer0.default
      port: 7051
    - host: org4-peer1.default
      port: 7051
  hlfIdentity:
    secretKey: org4msp.yaml
    secretName: wallet
    secretNamespace: default
  mspId: Org4MSP
  name: private
  externalPeersToJoin: []
  orderers:
    - certificate: |
${ORDERER0_TLS_CERT}
      url: grpcs://ord-node1.default:7050
  peersToJoin:
    - name: org4-peer0
      namespace: default
    - name: org4-peer1
      namespace: default
EOF
```
<br>

# Setting up monitoring

## Get hlf-operator values
```bash
helm get values hlf-operator --all
```

## Edit CAs
```bash
kubectl edit fabriccas org1-ca
```

## Edit peers
```bash
kubectl edit fabricpeers org1-peer0
```

## Edit orderers
```bash
kubectl edit fabricorderernodes ord-node1
```

The CRDs for the orderer, peer, and certificate authority have an optional parameter to create the service monitors to scrape the metrics automatically if Prometheus Operator is installed on the cluster.

```
  serviceMonitor:
    enabled: true
    interval: 10s
    labels: {}
    sampleLimit: 0
    scrapeTimeout: 10s
```

## Deploy service monitors
```bash
kubectl apply -f ../caliper-benchmark/monitors/ord-node1-monitor.yaml
kubectl apply -f ../caliper-benchmark/monitors/ord-node2-monitor.yaml
kubectl apply -f ../caliper-benchmark/monitors/ord-node3-monitor.yaml
kubectl apply -f ../caliper-benchmark/monitors/ord-node4-monitor.yaml
kubectl apply -f ../caliper-benchmark/monitors/org1-ca-monitor.yaml
kubectl apply -f ../caliper-benchmark/monitors/org4-ca-monitor.yaml
kubectl apply -f ../caliper-benchmark/monitors/org1-peer0-monitor.yaml
kubectl apply -f ../caliper-benchmark/monitors/org1-peer1-monitor.yaml
kubectl apply -f ../caliper-benchmark/monitors/org4-peer0-monitor.yaml
kubectl apply -f ../caliper-benchmark/monitors/org4-peer1-monitor.yaml
```

<!--
## Fetch the connection string from the Kubernetes secret
```bash
kubectl get secret org1-cp -o jsonpath="{.data.config\.yaml}" | base64 --decode > org1.yaml
```


## Create metadata file
```bash
rm code.tar.gz chaincode.tgz
export CHAINCODE_NAME=asset
export CHAINCODE_LABEL=asset
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
kubectl hlf externalchaincode sync --image=kfsoftware/chaincode-external:latest \
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
    --policy="OR('Org1MSP.member')" --channel=main
```


## Commit chaincode
```bash
kubectl hlf chaincode commit --config=org1.yaml --user=org1-admin-default --mspid=Org1MSP \
    --version "$VERSION" --sequence "$SEQUENCE" --name=$CHAINCODE_NAME \
    --policy="OR('Org1MSP.member')" --channel=main
```


## Invoke a transaction on the channel
```bash
kubectl hlf chaincode invoke --config=org1.yaml \
    --user=org1-admin-default --peer=org1-peer0.default \
    --chaincode=$CHAINCODE_NAME --channel=main \
    --fcn=initLedger
```


## Query assets in the channel
```bash
kubectl hlf chaincode query --config=org1.yaml \
    --user=org1-admin-default --peer=org1-peer0.default \
    --chaincode=$CHAINCODE_NAME --channel=main \
    --fcn=GetAllAssets -a '[]'
```


## Create an asset
```bash
kubectl hlf chaincode invoke --config=org1.yaml \
    --user=org1-admin-default --peer=org1-peer0.default \
    --chaincode=$CHAINCODE_NAME --channel=main \
    --fcn=CreateAsset -a "asset7" -a blue -a "5" -a "tom" -a "100"
```


## Query an asset
```bash
kubectl hlf chaincode query --config=org1.yaml \
    --user=org1-admin-default --peer=org1-peer0.default \
    --chaincode=$CHAINCODE_NAME --channel=main \
    --fcn=ReadAsset -a asset7
```
-->