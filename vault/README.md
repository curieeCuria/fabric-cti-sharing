## Add the HashiCorp Helm Repository
```bash
helm repo add hashicorp https://helm.releases.hashicorp.com
```

```bash
helm repo update
```

## Search for the Vault Chart
```bash
helm search repo hashicorp/vault
```

## Create a Namespace for Vault
```bash
kubectl create namespace vault
```

## Install Vault using Helm
```bash
helm install vault hashicorp/vault -f vault-values.yaml -n vault
```

## Initialize Vault
```bash
kubectl exec -it vault-0 -n vault -- vault operator init -key-shares=1 -key-threshold=1 # Replace vault-0 if needed
```
Save the unseal key and root token securely.

## Unseal Vault
```bash
kubectl exec -it vault-0 -n vault -- vault operator unseal <UNSEAL_KEY>
```

## Login to Vault
```bash
kubectl exec -it vault-0 -n vault -- vault login <ROOT_TOKEN>
```

## Copy and Apply Policies
Copy the policy files to the Vault pod:
```bash
kubectl cp cti-consumer.hcl vault/vault-0:/tmp/cti-consumer.hcl -n vault
kubectl cp cti-creator.hcl vault/vault-0:/tmp/cti-creator.hcl -n vault
```

Apply the policies:
```bash
kubectl exec -it vault-0 -n vault -- vault policy write cti-consumer /tmp/cti-consumer.hcl
kubectl exec -it vault-0 -n vault -- vault policy write cti-creator /tmp/cti-creator.hcl
```

Clean up the temporary files:
```bash
kubectl exec -it vault-0 -n vault -- rm /tmp/cti-consumer.hcl
kubectl exec -it vault-0 -n vault -- rm /tmp/cti-creator.hcl
```

## Enable secrets engine
```bash
kubectl exec -it vault-0 -n vault -- vault secrets enable -path=kv-v2 kv-v2
```

## Generate Tokens for Policies
```bash
kubectl exec -it vault-0 -n vault -- vault token create -policy="cti-creator"
kubectl exec -it vault-0 -n vault -- vault token create -policy="cti-consumer"
```

## Access the Vault UI (optional)
To access the Vault UI, first find the external IP and port for the Vault service:
```bash
kubectl get svc -n vault vault
```
Locate the `EXTERNAL-IP` and `PORT(S)` for the `vault` service.

Open a web browser and navigate to:
```
http://<EXTERNAL-IP>:<PORT>
```
Log in using the Root Token saved during the [initialization step](#initialize-vault).