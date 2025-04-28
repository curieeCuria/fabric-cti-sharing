## Add the HashiCorp Helm Repository
```
helm repo add hashicorp https://helm.releases.hashicorp.com
```

```
helm repo update
```

## Search for the Vault Chart
```
helm search repo hashicorp/vault
```

## Create a Namespace for Vault
```
kubectl create namespace vault
```

## Install Vault using Helm
```
helm install vault hashicorp/vault -f vault-values.yaml -n vault
```

## Initialize Vault
```
kubectl exec -it vault-0 -n vault -- vault operator init -key-shares=1 -key-threshold=1 # Replace vault-0 if needed
```
Save the unseal key and root token securely.

## Unseal Vault
```
kubectl exec -it vault-0 -n vault -- vault operator unseal <UNSEAL_KEY>
```

## Login to Vault
```
kubectl exec -it vault-0 -n vault -- vault login <ROOT_TOKEN>
```

## Copy the policy files to the Vault pod
```
kubectl cp cti-consumer.hcl vault/vault-0:/tmp/cti-consumer.hcl -n vault
kubectl cp cti-creator.hcl vault/vault-0:/tmp/cti-creator.hcl -n vault
```

## Apply the policies
```
kubectl exec -it vault-0 -n vault -- vault policy write cti-consumer /tmp/cti-consumer.hcl
kubectl exec -it vault-0 -n vault -- vault policy write cti-creator /tmp/cti-creator.hcl
```

## Clean up the temporary files
```
kubectl exec -it vault-0 -n vault -- rm /tmp/cti-consumer.hcl
kubectl exec -it vault-0 -n vault -- rm /tmp/cti-creator.hcl
```

## Generate tokens for policies
```
kubectl exec -it vault-0 -n vault -- vault token create -policy="cti-creator"
kubectl exec -it vault-0 -n vault -- vault token create -policy="cti-consumer"
```