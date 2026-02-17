"""Tests for core security utilities (password hashing, JWT, password validation)."""
from datetime import timedelta

from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    decode_access_token,
    validate_password_strength,
    generate_password,
)


class TestPasswordHashing:
    def test_hash_and_verify(self):
        password = "SecurePass123"
        hashed = get_password_hash(password)
        assert hashed != password
        assert verify_password(password, hashed)

    def test_wrong_password_fails(self):
        hashed = get_password_hash("CorrectPass1")
        assert not verify_password("WrongPass1", hashed)

    def test_different_hashes_for_same_password(self):
        pw = "SamePassword1"
        h1 = get_password_hash(pw)
        h2 = get_password_hash(pw)
        assert h1 != h2  # bcrypt uses random salt


class TestJWT:
    def test_create_and_decode_token(self):
        token = create_access_token(data={"sub": "42"})
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "42"

    def test_expired_token_returns_none(self):
        token = create_access_token(
            data={"sub": "1"},
            expires_delta=timedelta(seconds=-1),
        )
        assert decode_access_token(token) is None

    def test_invalid_token_returns_none(self):
        assert decode_access_token("invalid.token.value") is None

    def test_token_contains_expiry(self):
        token = create_access_token(data={"sub": "1"})
        payload = decode_access_token(token)
        assert "exp" in payload


class TestPasswordValidation:
    def test_valid_password(self):
        assert validate_password_strength("StrongPass1") is None

    def test_too_short(self):
        result = validate_password_strength("Ab1")
        assert result is not None
        assert "Zeichen" in result

    def test_no_uppercase(self):
        result = validate_password_strength("lowercase1only")
        assert result is not None

    def test_no_lowercase(self):
        result = validate_password_strength("UPPERCASE1ONLY")
        assert result is not None

    def test_no_digit(self):
        result = validate_password_strength("NoDigitsHere")
        assert result is not None


class TestGeneratePassword:
    def test_generated_password_is_valid(self):
        pw = generate_password()
        assert validate_password_strength(pw) is None

    def test_generated_password_length(self):
        pw = generate_password(20)
        assert len(pw) == 20
