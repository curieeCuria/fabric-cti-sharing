import argparse
import hashlib
import os
from cti.utils import (
    generate_aes_key,
    encrypt_cti_data,
    store_aes_key,
    add_file_to_ipfs,
    gather_cti_metadata,
    submit_metadata_to_fabric,
    get_metadata_from_fabric,
    retrieve_file_from_ipfs,
    retrieve_aes_key,
    decrypt_cti_data
)
import hvac
import uuid

VAULT_ADDR = os.getenv("VAULT_ADDR", "http://172.20.0.2:8200")
CTI_CREATOR_TOKEN = os.getenv("CTI_CREATOR_TOKEN")
CTI_CONSUMER_TOKEN = os.getenv("CTI_CONSUMER_TOKEN")

def create_cti(args):
    try:
        # Initialize Vault client
        creator_client = hvac.Client(
            url=VAULT_ADDR,
            token=CTI_CREATOR_TOKEN
        )

        # Generate AES key
        aes_key = generate_aes_key()

        # Encrypt the CTI data
        encrypted_data = encrypt_cti_data(aes_key, args.filepath)

        # Store AES key in Vault
        aes_key_name = f"{args.sender_identity}_{os.path.basename(args.filepath).split('.')[0]}_{uuid.uuid4().hex[:6]}"
        store_aes_key(creator_client, aes_key_name, aes_key)

        # Add encrypted data to IPFS
        cid = add_file_to_ipfs(encrypted_data, filename="encrypted_data")

        # Gather metadata
        metadata = gather_cti_metadata(args.description, args.sender_identity, cid, aes_key_name, args.filepath)

        # Submit metadata to Fabric
        submit_metadata_to_fabric(
            metadata=metadata,
            chaincode_name="ctitransfer104",
            channel_name="demo",
            config_file="cti/org1.yaml",
            user="org1-admin-default",
            peer="org1-peer0.default"
        )
        print(f"CTI UUID: {metadata['UUID']}")
    except Exception as e:
        print(f"Error creating CTI: {e}")

def decrypt_cti(args):
    try:
        # Retrieve metadata from Fabric
        metadata = get_metadata_from_fabric(
            uuid=args.uuid,
            chaincode_name="ctitransfer104",
            channel_name="demo",
            config_file="cti/org1.yaml",
            user="org1-admin-default",
            peer="org1-peer0.default"
        )
        print("Metadata retrieved successfully!")

        # Extract metadata fields
        cid = metadata["CID"]
        aes_key_name = metadata["VaultKey"].split("/")[-1]
        expected_hash = metadata["SHA256Hash"]

        # Retrieve encrypted data from IPFS
        encrypted_data = retrieve_file_from_ipfs(cid)
        print("Encrypted data retrieved from IPFS.")

        # Retrieve AES key from Vault
        consumer_client = hvac.Client(
            url=VAULT_ADDR,
            token=CTI_CONSUMER_TOKEN
        )
        aes_key = retrieve_aes_key(consumer_client, aes_key_name)
        print("AES key retrieved from Vault.")

        # Decrypt the data
        decrypted_data = decrypt_cti_data(aes_key, encrypted_data)
        print("Data decrypted successfully.")

        # Verify the hash of the decrypted data
        decrypted_hash = hashlib.sha256(decrypted_data).hexdigest()
        if decrypted_hash == expected_hash:
            print("Decryption successful! The hashes match.")
        else:
            print("Decryption failed! The hashes do not match.")

        # Save or print the decrypted data
        if args.output:
            with open(args.output, "wb") as f:
                f.write(decrypted_data)
            print(f"Decrypted data saved to {args.output}.")
        else:
            print("Decrypted data:")
            print(decrypted_data.decode("utf-8"))  # Assuming the data is text-based
    except Exception as e:
        print(f"Error decrypting CTI: {e}")

def main():
    parser = argparse.ArgumentParser(description="CTI Sharing System CLI")
    subparsers = parser.add_subparsers(title="Commands", dest="command")

    # Subcommand for creating CTI
    create_parser = subparsers.add_parser("create", help="Create and submit CTI metadata")
    create_parser.add_argument("filepath", type=str, help="Path to the CTI file")
    create_parser.add_argument("sender_identity", type=str, help="Sender's identity/organization")
    create_parser.add_argument("description", type=str, help="Description of the CTI")
    create_parser.set_defaults(func=create_cti)

    # Subcommand for decrypting CTI
    decrypt_parser = subparsers.add_parser("decrypt", help="Decrypt CTI data using metadata")
    decrypt_parser.add_argument("uuid", type=str, help="UUID of the CTI metadata")
    decrypt_parser.add_argument("output", type=str, nargs="?", default=None, help="Path to save the decrypted file (optional)")
    decrypt_parser.set_defaults(func=decrypt_cti)

    args = parser.parse_args()
    if args.command:
        args.func(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()