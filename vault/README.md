helm repo add hashicorp https://helm.releases.hashicorp.com


helm repo update


helm search repo hashicorp/vault


kubectl create namespace vault


helm install vault hashicorp/vault -f vault-values.yaml -n vault


kubectl exec -it vault-0 -n vault -- vault operator init -key-shares=1 -key-threshold=1 # Replace vault-0 if needed


kubectl exec -it vault-0 -n vault -- vault operator unseal <UNSEAL_KEY>