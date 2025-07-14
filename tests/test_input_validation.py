import pytest
from pydantic import ValidationError

from src.app.auth.schemas import RegisterRequest, UpdateProfileRequest
from src.app.core.schema import SemanticRequest
from src.app.ratings.schemas import RatingRequest


class TestAuthValidation:
    """Test authentication input validation"""

    def test_register_password_validation(self):
        """Test password strength requirements"""
        # Valid password
        valid = RegisterRequest(email="test@example.com", password="StrongPass123")
        assert valid.password == "StrongPass123"

        # Too short
        with pytest.raises(ValidationError) as exc:
            RegisterRequest(email="test@example.com", password="Short1")
        assert "at least 8 characters" in str(exc.value)

        # Missing uppercase
        with pytest.raises(ValidationError) as exc:
            RegisterRequest(email="test@example.com", password="weakpass123")
        assert "uppercase letter" in str(exc.value)

        # Missing digit
        with pytest.raises(ValidationError) as exc:
            RegisterRequest(email="test@example.com", password="WeakPassword")
        assert "one digit" in str(exc.value)

    def test_email_validation(self):
        """Test email format validation"""
        # Invalid email
        with pytest.raises(ValidationError) as exc:
            RegisterRequest(email="invalid-email", password="StrongPass123")
        assert "valid email" in str(exc.value).lower()

    def test_profile_update_validation(self):
        """Test profile update field validation"""
        # Valid
        valid = UpdateProfileRequest(first_name="John", last_name="Doe")
        assert valid.first_name == "John"

        # Empty names
        with pytest.raises(ValidationError) as exc:
            UpdateProfileRequest(first_name="", last_name="Doe")
        assert "at least 1 character" in str(exc.value)

        # Too long
        with pytest.raises(ValidationError) as exc:
            UpdateProfileRequest(first_name="A" * 51, last_name="Doe")
        assert "at most 50 characters" in str(exc.value)


class TestRatingValidation:
    """Test rating input validation"""

    def test_rating_type_validation(self):
        """Test rating type enum validation"""
        # Valid
        valid = RatingRequest(rating_type="thumbs_up")
        assert valid.rating_type == "thumbs_up"

        # Invalid type
        with pytest.raises(ValidationError) as exc:
            RatingRequest(rating_type="invalid_type")
        assert "pattern" in str(exc.value)

    def test_feedback_length_validation(self):
        """Test feedback text length limits"""
        # Valid
        valid = RatingRequest(rating_type="thumbs_down", feedback_text="This could be improved")
        assert valid.feedback_text == "This could be improved"

        # Too long
        with pytest.raises(ValidationError) as exc:
            RatingRequest(rating_type="thumbs_up", feedback_text="A" * 1001)
        assert "at most 1000 characters" in str(exc.value)


class TestQueryValidation:
    """Test query input validation"""

    def test_semantic_query_validation(self):
        """Test semantic search query validation"""
        # Valid
        valid = SemanticRequest(query="What is the temperature?")
        assert valid.query == "What is the temperature?"

        # Empty query
        with pytest.raises(ValidationError) as exc:
            SemanticRequest(query="")
        assert "at least 1 character" in str(exc.value)

        # Too long
        with pytest.raises(ValidationError) as exc:
            SemanticRequest(query="A" * 1001)
        assert "at most 1000 characters" in str(exc.value)
