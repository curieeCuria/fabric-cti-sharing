"""
This module provides utility functions for handling CTI (Cyber Threat Intelligence) data, 
including file hashing, AES encryption/decryption, and integration with HashiCorp Vault for 
secure key storage and retrieval. IPFS (InterPlanetary File System) is used for storing and
retrieving files.

Functions:
    calculate_file_sha256(filepath: str) -> str:

    generate_aes_key() -> bytes:
        Generate a random 256-bit AES key.

    encrypt_cti_data(aes_key: bytes, filepath: str) -> bytes:

    decrypt_cti_data(aes_key: bytes, cipher_text: bytes) -> bytes:

    store_aes_key(client, key_name: str, key: bytes):
        Store the AES key securely in HashiCorp Vault.

    retrieve_aes_key(client, key_name: str) -> bytes:
        Retrieve the AES key from HashiCorp Vault.
    
    add_file_to_ipfs(file_data: bytes, filename: str = "data") -> str:
        Add in-memory file data to IPFS and return the CID (Content Identifier).
    
    retrieve_file_from_ipfs(cid: str) -> bytes:
        Retrieve file data from IPFS using its CID and return it as bytes.

Example Usage:
    This script can be executed directly to demonstrate the encryption and decryption of a CTI file.
    It also shows how to store and retrieve AES keys using HashiCorp Vault.

    Command-line usage:
        python utils.py <CTI_FILENAME>

    If no filename is provided, it defaults to "sample_cti.json".

Note:
    Ensure that HashiCorp Vault is running and accessible at the specified URL.
    Set the environment variables `CTI_CREATOR_TOKEN` and `CTI_CONSUMER_TOKEN` 
    with appropriate Vault tokens.
"""

import hashlib
import sys
import os
from base64 import b64encode, b64decode
import json
import subprocess
from datetime import datetime
import uuid
import requests
import hvac
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes

IPFS_ADD_URL = os.getenv("IPFS_ADD_URL", "http://172.20.0.2:9094/add")
IPFS_RETRIEVE_URL = os.getenv("IPFS_RETRIEVE_URL", "http://172.20.0.2:8080/ipfs")
VAULT_ADDR = os.getenv("VAULT_ADDR", "http://172.20.0.2:8200")

def calculate_file_sha256(filepath: str) -> str:
    """
    Calculate the SHA-256 hash of a file.
    """
    sha256_hash = hashlib.sha256()
    try:
        with open(filepath, "rb") as f:
            # Read the file in chunks to avoid memory issues with large files
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()
    except FileNotFoundError as e:
        raise FileNotFoundError(f"Error: File not found at {filepath}") from e
    except IOError as e:
        raise IOError(f"An error occurred while reading file {filepath}: {e}") from e

def get_sender_identity(peername: str) -> str:
    """
    Get the sender identity based on the peer name.
    """
    if peername.startswith("org1"):
        return "HeadOfOperations", "HO"
    elif peername.startswith("org2"):
        return "IntelligenceUnit", "IU"
    elif peername.startswith("org3"):
        return "TacticalUnit", "TU"
    elif peername.startswith("org4"):
        return "SpecialOperationsUnit", "SOU"
    else:
        raise ValueError(f"Unknown peer name: {peername}")

def generate_aes_key() -> bytes:
    """
    Generate a random AES key.
    """
    return get_random_bytes(32)

def encrypt_cti_data(aes_key: bytes, filepath: str) -> bytes:
    """
    Encrypt the CTI data using AES GCM mode.
    """
    try:
        with open(filepath, "rb") as f:
            plain_text = f.read()
    except (FileNotFoundError, IOError) as e:
        raise IOError(f"Error reading file {filepath}: {e}") from e

    cipher = AES.new(aes_key, AES.MODE_GCM)
    cipher_text, tag = cipher.encrypt_and_digest(plain_text)
    return cipher.nonce + cipher_text + tag

def decrypt_cti_data(aes_key: bytes, cipher_text: bytes) -> bytes:
    """
    Decrypt the CTI data using AES GCM mode.
    """
    nonce = cipher_text[:16]
    tag = cipher_text[-16:]
    encrypted_data = cipher_text[16:-16]
    cipher = AES.new(aes_key, AES.MODE_GCM, nonce=nonce)
    try:
        plain_text = cipher.decrypt_and_verify(encrypted_data, tag)
    except ValueError as e:
        raise ValueError("Decryption failed. Integrity check failed.") from e
    return plain_text

def store_aes_key(client, key_name: str, key: bytes):
    """
    Store the AES key in Vault.
    """
    try:
        wrapped_key = b64encode(key).decode('utf-8')
        client.secrets.kv.v2.create_or_update_secret(
            mount_point="kv-v2",
            path=key_name,
            secret={'value': wrapped_key}
        )
        print(f"AES key '{key_name}' stored successfully at path 'kv-v2/data/{key_name}'.")
    except hvac.exceptions.VaultError as e:
        print(f"Error storing AES key '{key_name}': {e}")
        raise

def retrieve_aes_key(client, key_name: str) -> bytes:
    """
    Retrieve the AES key from Vault.
    """
    try:
        secret = client.secrets.kv.v2.read_secret(
            mount_point="kv-v2",
            path=key_name
        )
        wrapped_key = secret['data']['data']['value']
        print(f"AES key '{key_name}' retrieved successfully from path 'kv-v2/data/{key_name}'.")
        return b64decode(wrapped_key)
    except hvac.exceptions.VaultError as e:
        print(f"Error retrieving AES key '{key_name}': {e}")
        raise

def add_file_to_ipfs(file_data: bytes, filename: str = "data") -> str:
    """
    Add in-memory file data to IPFS and return the CID (Content Identifier).
    """
    try:
        response = requests.post(IPFS_ADD_URL, files={'file': (filename, file_data)}, timeout=10)
        response.raise_for_status()
        cid = response.json().get('cid')
        if not cid:
            raise ValueError("Failed to retrieve CID from IPFS response.")
        print(f"File added to IPFS with CID: {cid}")
        return cid
    except requests.RequestException as e:
        raise RuntimeError(f"Error adding data to IPFS: {e}") from e

def retrieve_file_from_ipfs(cid: str) -> bytes:
    """
    Retrieve file data from IPFS using its CID and return it as bytes.
    """
    ipfs_retrieve_url = f"{IPFS_RETRIEVE_URL}/{cid}"
    try:
        response = requests.get(ipfs_retrieve_url, timeout=10)
        response.raise_for_status()
        print(f"Data with CID '{cid}' retrieved from IPFS.")
        return response.content
    except requests.RequestException as e:
        raise RuntimeError(f"Error retrieving data from IPFS: {e}") from e

def gather_cti_metadata(description: str, sender_identity: str, cid: str, aes_key_name: str, filepath: str) -> dict:
    """
    Gather metadata for the CTI instance.
    """
    metadata = {
        "UUID": str(uuid.uuid4()),
        "Description": description,
        "Timestamp": datetime.now().replace(microsecond=0).isoformat(),
        "SenderIdentity": sender_identity,
        "CID": cid,
        "VaultKey": f"kv-v2/data/{aes_key_name}",
        "SHA256Hash": calculate_file_sha256(filepath)
    }
    return metadata

def submit_metadata_to_fabric(metadata: dict, chaincode_name: str, channel_name: str, config_file: str, user: str, peer: str):
    """
    Submit CTI to the Hyperledger Fabric ledger.
    """
    metadata_json = json.dumps(metadata)
    command = [
        "kubectl", "hlf", "chaincode", "invoke",
        "--config", config_file,
        "--user", user,
        "--peer", peer,
        "--chaincode", chaincode_name,
        "--channel", channel_name,
        "--fcn", "CreateCTIMetadata",
        "--args", metadata_json
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Failed to invoke chaincode: {result.stderr}")
    print(f"CTI submitted successfully!")

def get_metadata_from_fabric(uuid: str, chaincode_name: str, channel_name: str, config_file: str, user: str, peer: str) -> dict:
    """
    Retrieve CTI metadata from the Hyperledger Fabric ledger by UUID.
    """
    command = [
        "kubectl", "hlf", "chaincode", "invoke",
        "--config", config_file,
        "--user", user,
        "--peer", peer,
        "--chaincode", chaincode_name,
        "--channel", channel_name,
        "--fcn", "ReadCTIMetadata",
        "--args", uuid
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Failed to query chaincode: {result.stderr}")
    
    try:
        metadata = json.loads(result.stdout)
        return metadata
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse chaincode response: {result.stdout}") from e

def get_all_metadata_from_fabric(chaincode_name: str, channel_name: str, config_file: str, user: str, peer: str, page_size: int = 2000) -> list:
    """
    Retrieve all CTI metadata from the Hyperledger Fabric ledger with client-side pagination.
    """
    all_metadata = []
    bookmark = ""

    while True:
        command = [
            "kubectl", "hlf", "chaincode", "invoke",
            "--config", config_file,
            "--user", user,
            "--peer", peer,
            "--chaincode", chaincode_name,
            "--channel", channel_name,
            "--fcn", "GetAllCTI",
            "--args", str(page_size),
            "--args", f'{bookmark}'
        ]

        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Failed to query chaincode: {result.stderr}")

        try:
            response = json.loads(result.stdout)
            metadata_list = response.get("metadataList", [])
            bookmark = response.get("bookmark", "")

            all_metadata.extend(metadata_list)

            if not bookmark:
                break
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse chaincode response: {result.stdout}") from e

    return all_metadata

def delete_metadata_from_fabric(uuid: str, chaincode_name: str, channel_name: str, config_file: str, user: str, peer: str):
    """
    Delete CTI metadata from the Hyperledger Fabric ledger by UUID.
    """
    command = [
        "kubectl", "hlf", "chaincode", "invoke",
        "--config", config_file,
        "--user", user,
        "--peer", peer,
        "--chaincode", chaincode_name,
        "--channel", channel_name,
        "--fcn", "DeleteCTIMetadata",
        "--args", uuid
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Failed to invoke chaincode: {result.stderr}")

# Example usage: python utils.py sample_cti.json
if __name__ == "__main__":

    if len(sys.argv) > 1:
        CTI_FILENAME = sys.argv[1]
    else:
        CTI_FILENAME = "sample_cti.json" # Default file name

    try:
        ORIGINAL_HASH = calculate_file_sha256(CTI_FILENAME)
        print(f"Original CTI File: {CTI_FILENAME}")
        print(f"SHA-256 Hash: {ORIGINAL_HASH}")
    except (FileNotFoundError, IOError) as e:
        print(e)
        sys.exit(1)


    # Example Vault usage
    creator_client = hvac.Client(
        url=VAULT_ADDR,
        token=os.environ.get('CTI_CREATOR_TOKEN') # export CTI_CREATOR_TOKEN='<token>'
    )

    # Generate a new AES key
    aes_key_1 = generate_aes_key()
    print(f"Generated AES key: {aes_key_1.hex()[:3]}...")

    # Encrypt the CTI data
    try:
        encrypted_file_data = encrypt_cti_data(aes_key_1, CTI_FILENAME)
        print(f"Encrypted data: {encrypted_file_data.hex()[:3]}...")

        AES_KEY_NAME = 'example_key_name_0'  # Example key name
        store_aes_key(creator_client, AES_KEY_NAME, aes_key_1)
        print(f"AES key stored in Vault with name: {AES_KEY_NAME}")
    except (FileNotFoundError, IOError) as e:
        print(e)
        sys.exit(1)

    # Add the encrypted data to IPFS
    try:
        encrypted_cid = add_file_to_ipfs(encrypted_file_data, filename="encrypted_data")
        print(f"This can be passed to chaincode: {encrypted_cid}")
    except RuntimeError as e:
        print(e)
        sys.exit(1)


    print("\n---Decrypting the data---")
    # Retrieve the encrypted data from IPFS
    try:
        retrieved_encrypted_data = retrieve_file_from_ipfs(encrypted_cid)
        print(f"Retrieved encrypted data from IPFS: {retrieved_encrypted_data.hex()[:16]}...")
    except RuntimeError as e:
        print(e)
        sys.exit(1)

    # Retrieve the AES key from Vault
    consumer_client = hvac.Client(
        url=VAULT_ADDR,
        token=os.environ.get('CTI_CONSUMER_TOKEN') # export CTI_CONSUMER_TOKEN='<token>'
    )

    retrieved_key = retrieve_aes_key(consumer_client, AES_KEY_NAME)
    print(f"Retrieved AES key: {retrieved_key.hex()[:3]}...")

    # Verify the retrieved key matches the original key
    assert aes_key_1 == retrieved_key, "Keys do not match!"
    print("Keys match successfully!")

    # Decrypt the data
    try:
        decrypted_data = decrypt_cti_data(retrieved_key, retrieved_encrypted_data)
        print(f"Decrypted data: {decrypted_data[:32]}...")

        # Verify the decrypted data matches the original file
        DECRYPTED_HASH = hashlib.sha256(decrypted_data).hexdigest()
        print(f"Decrypted data SHA-256 Hash: {DECRYPTED_HASH}")

        if ORIGINAL_HASH == DECRYPTED_HASH:
            print("Decryption successful! The hashes match.")
        else:
            print("Decryption failed! The hashes do not match.")
    except ValueError as e:
        print(f"Decryption failed: {e}")
        sys.exit(1)
