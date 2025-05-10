'''
This script extracts the certificate and private key from the YAML files
in the ../cti/resources directory and saves them in the ../cti/keystore directory.
'''

import os
import yaml

input_dir = "../cti/resources"
output_dir = "../cti/keystore"
orgs = ["org1msp.yaml", "org2msp.yaml", "org3msp.yaml", "org4msp.yaml"]

os.makedirs(output_dir, exist_ok=True)

for org_file in orgs:
    input_path = os.path.join(input_dir, org_file)
    org_name = org_file.split("msp")[0]

    with open(input_path, "r") as file:
        data = yaml.safe_load(file)

    cert = data["cert"]["pem"]
    key = data["key"]["pem"]

    cert_path = os.path.join(output_dir, f"{org_name}cert.pem")
    key_path = os.path.join(output_dir, f"{org_name}key.pem")

    with open(cert_path, "w") as cert_file:
        cert_file.write(cert)

    with open(key_path, "w") as key_file:
        key_file.write(key)

    print(f"Extracted cert and key for {org_name} to {output_dir}")