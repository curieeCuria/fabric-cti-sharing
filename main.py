from cti.utils import (
    generate_aes_key,
    encrypt_cti_data,
    store_aes_key,
    add_file_to_ipfs,
    gather_cti_metadata,
    submit_metadata_to_fabric
)
import hvac
import os
import uuid

VAULT_ADDR = os.getenv("VAULT_ADDR", "http://172.20.0.2:8200")
CTI_CREATOR_TOKEN = os.getenv("CTI_CREATOR_TOKEN")

if __name__ == "__main__":
    try:
        # Input from the sender
        filepath = input("Enter the filepath of the CTI file: ").strip()
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"the file '{filepath}' does not exist.")
        if not os.path.isfile(filepath):
            raise ValueError(f"'{filepath}' is not a file.")
        
        sender_identity = input("Enter the sender's identity/organization: ").strip()
        cti_type = input("Enter the CTI type: ").strip()

        # Initialize Vault client
        creator_client = hvac.Client(
            url=VAULT_ADDR,
            token=CTI_CREATOR_TOKEN
        )
    except (FileNotFoundError, ValueError) as file_error:
        print(f"File error: {file_error}")
        exit(1)
    except Exception as e:
        print(f"Error: {e}")
        exit(1)

    try:
        # Generate AES key
        aes_key = generate_aes_key()
        print(f"Generated AES key: {aes_key.hex()[:3]}...")

        # Encrypt the CTI data
        encrypted_data = encrypt_cti_data(aes_key, filepath)
        print(f"Encrypted data: {encrypted_data.hex()[:3]}...")

        # Store AES key in Vault
        aes_key_name = f"{sender_identity}_{os.path.basename(filepath).split('.')[0]}_{uuid.uuid4().hex[:6]}"
        store_aes_key(creator_client, aes_key_name, aes_key)

        # Add encrypted data to IPFS
        cid = add_file_to_ipfs(encrypted_data, filename="encrypted_data")

        # Gather metadata
        metadata = gather_cti_metadata(filepath, cid, aes_key_name, sender_identity, cti_type)
        print(f"\nMetadata gathered: {metadata}")

        # Submit metadata to Fabric
        submit_metadata_to_fabric(
            metadata=metadata,
            chaincode_name="cti_chaincode",
            channel_name="demo",
            config_file="org1.yaml",
            user="org1-admin-default",
            peer="org1-peer0.default"
        )
        print("Metadata submitted to Fabric successfully.")

    except Exception as e:
        print(f"Error: {e}")