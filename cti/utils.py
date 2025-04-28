import hashlib
import sys
import hvac
from base64 import b64encode, b64decode

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
    except FileNotFoundError:
        raise FileNotFoundError(f"Error: File not found at {filepath}")
    except IOError as e:
        raise IOError(f"An error occurred while reading file {filepath}: {e}")

def store_aes_key(client, key_name: str, key: bytes):
    try:
        wrapped_key = b64encode(key).decode('utf-8')
        # path = f"cti/keys/{key_name}"
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
    try:
        # path = f"cti/keys/{key_name}"
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

# Example usage: python utils.py sample_cti.json
if __name__ == "__main__":

    if len(sys.argv) > 1:
        cti_filename = sys.argv[1]
    else:
        cti_filename = "sample_cti.json" # Default file name

    try:
        original_hash = calculate_file_sha256(cti_filename)
        print(f"Original CTI File: {cti_filename}")
        print(f"SHA-256 Hash: {original_hash}")
    except (FileNotFoundError, IOError) as e:
        print(e)
        sys.exit(1)

    
    # Example Vault usage
    client = hvac.Client(
        url='http://172.20.0.2:8200',
        token='hvs.xxxx...' # cti-creator token
    )

    aes_key = b'example_aes_key_1234567890'  # Example AES key
    key_name = 'example_key_name'  # Example key name

    store_aes_key(client, key_name, aes_key)

    client = hvac.Client(
        url='http://172.20.0.2:8200',
        token='hvs.xxxx...' # cti-consumer token
    )

    retrieved_key = retrieve_aes_key(client, key_name)
    print(f"Retrieved AES key: {retrieved_key}")

    # Verify the retrieved key matches the original key
    assert aes_key == retrieved_key, "Keys do not match!"
    print("Keys match successfully!")