import bcrypt


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
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash

    Args:
        password: Plain text password
        hashed_password: Stored hash

    Returns:
        bool: True if password matches
    """
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except Exception:
        return False