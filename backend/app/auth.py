"""Password hashing utilities using built-in hashlib (pbkdf2_hmac)."""
import hashlib
import os
import hmac


def hash_password(password: str) -> str:
    salt = os.urandom(16).hex()
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
    return f"{salt}${key.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, key_hex = stored_hash.split("$", 1)
        expected = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
        return hmac.compare_digest(expected, bytes.fromhex(key_hex))
    except Exception:
        return False
