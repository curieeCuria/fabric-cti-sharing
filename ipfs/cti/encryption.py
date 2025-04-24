from pathlib import Path
from self_encryption import encrypt, decrypt, encrypt_from_file, decrypt_from_storage, DataMap

# Basic in-memory encryption/decryption
def basic_example():
    # Create test data (must be at least 3072 bytes)
    data = b"Hello, World!" * 1000
    
    # Encrypt data - returns data map and encrypted chunks
    data_map, chunks = encrypt(data)
    print(f"Data encrypted into {len(chunks)} chunks")
    print(f"Data map has child level: {data_map.child()}")
    
    # Decrypt data
    decrypted = decrypt(data_map, chunks)
    decrypted = bytes(decrypted)
    print(f"Decrypted data: {decrypted[:50]}...")  # Print a snippet of the decrypted data
    print(f"Original data: {data[:50]}...")        # Print a snippet of the original data
    assert data == decrypted

def encrypt_file(file_path):
    # Setup paths
    input_path = Path(file_path)
    chunk_dir = Path("chunks")
    
    # Ensure chunk directory exists
    chunk_dir.mkdir(exist_ok=True)
    
    # Encrypt file
    data_map, chunk_names = encrypt_from_file(str(input_path), str(chunk_dir))
    print(f"File encrypted into {len(chunk_names)} chunks")

    # Save data map
    with open("data_map.json", "w") as dm_file:
        dm_file.write(data_map.to_json())
    print("Encryption completed. Data map saved to data_map.json.")

def decrypt_file(data_map_path, chunks_path, output_file):
    output_path = Path(output_file)

    # Load data map
    with open(data_map_path, "r") as dm_file:
        data_map = DataMap.from_json(dm_file.read())

    # Create chunk retrieval function
    def get_chunk(hash_hex: str) -> bytes:
        chunk_path = chunks_path / hash_hex
        return chunk_path.read_bytes()
    
    # Decrypt file
    decrypt_from_storage(data_map, str(output_path), get_chunk)
    print(f"Decryption completed. Decrypted file saved to {output_file}.")

if __name__ == "__main__":
    encrypt_file("url.json")
    decrypt_file("data_map.json", Path("chunks"), "decrypted_url.json")