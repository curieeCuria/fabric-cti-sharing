import hashlib
import sys

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