import hashlib
import secrets
import bcrypt
from typing import Tuple

def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt
    
    Args:
        password: Plain text password
    
    Returns:
        str: Hashed password
    """
    # Generate salt and hash password
    salt = bcrypt.gensalt()
    password_bytes = password.encode('utf-8')
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash
    
    Args:
        plain_password: Plain text password to verify
        hashed_password: Stored hashed password
    
    Returns:
        bool: True if password matches
    """
    try:
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False

def generate_random_password(length: int = 12) -> str:
    """
    Generate a secure random password
    
    Args:
        length: Password length (default: 12)
    
    Returns:
        str: Random password
    """
    alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def hash_token(token: str) -> str:
    """
    Hash a token for secure storage
    
    Args:
        token: Token to hash
    
    Returns:
        str: SHA256 hash of the token
    """
    return hashlib.sha256(token.encode()).hexdigest()

def generate_secure_token(length: int = 32) -> Tuple[str, str]:
    """
    Generate a secure random token and its hash
    
    Args:
        length: Token length in bytes (default: 32)
    
    Returns:
        Tuple[str, str]: (original_token, hashed_token)
    """
    token = secrets.token_urlsafe(length)
    token_hash = hash_token(token)
    return token, token_hash

def is_password_strong(password: str) -> Tuple[bool, list]:
    """
    Check if password meets strength requirements
    
    Args:
        password: Password to check
    
    Returns:
        Tuple[bool, list]: (is_strong, list_of_issues)
    """
    issues = []
    
    if len(password) < 8:
        issues.append("Password must be at least 8 characters long")
    
    if not any(c.islower() for c in password):
        issues.append("Password must contain at least one lowercase letter")
    
    if not any(c.isupper() for c in password):
        issues.append("Password must contain at least one uppercase letter")
    
    if not any(c.isdigit() for c in password):
        issues.append("Password must contain at least one digit")
    
    if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
        issues.append("Password must contain at least one special character")
    
    return len(issues) == 0, issues