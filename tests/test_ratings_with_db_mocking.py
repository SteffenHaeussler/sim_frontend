"""Test ratings endpoints with complete database mocking"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import status

from src.app.models import UserResponseRating


class TestRatingsWithMocking:
    """Test ratings endpoints with full database mocking"""

    @pytest.mark.asyncio
    async def test_submit_rating_success(self, client_with_mocked_db, mock_db_session, mock_user):
        """Test successful rating submission"""
        # Mock token verification to return our mock user's ID
        from src.app.auth.jwt_utils import TokenData

        token_data = TokenData(
            user_id=str(mock_user.id), email=mock_user.email, organisation_id=str(mock_user.organisation_id)
        )

        with patch("src.app.auth.dependencies.verify_token", return_value=token_data):
            # Mock user lookup for active user check
            user_result = MagicMock()
            user_result.scalar_one_or_none.return_value = mock_user
            mock_db_session.execute.return_value = user_result

            # Rating data
            rating_data = {
                "rating_type": "thumbs_up",
                "message_context": "What is the weather today?",
                "feedback_text": "Great response!",
            }

            # Add tracking headers
            headers = {
                "Authorization": "Bearer test-token",
                "x-session-id": "test-session-123",
                "x-event-id": "test-event-456",
                "x-request-id": "test-request-789",
            }

            response = client_with_mocked_db.post("/ratings/submit", json=rating_data, headers=headers)

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["message"] == "Rating submitted successfully"
            assert data["rating_type"] == "thumbs_up"

            # Verify database operations
            assert mock_db_session.add.called
            assert mock_db_session.commit.called
            assert mock_db_session.refresh.called

            # Verify the rating object was created correctly
            rating_obj = mock_db_session.add.call_args[0][0]
            assert isinstance(rating_obj, UserResponseRating)
            assert rating_obj.rating_type == "thumbs_up"
            assert rating_obj.rating_value == 1
            assert rating_obj.session_id == "test-session-123"
            assert rating_obj.event_id == "test-event-456"

    @pytest.mark.asyncio
    async def test_submit_thumbs_down_rating(self, client_with_mocked_db, mock_db_session, mock_user):
        """Test thumbs down rating submission"""
        from src.app.auth.jwt_utils import TokenData

        token_data = TokenData(
            user_id=str(mock_user.id), email=mock_user.email, organisation_id=str(mock_user.organisation_id)
        )

        with patch("src.app.auth.dependencies.verify_token", return_value=token_data):
            # Mock user lookup for active user check
            user_result = MagicMock()
            user_result.scalar_one_or_none.return_value = mock_user
            mock_db_session.execute.return_value = user_result

            rating_data = {
                "rating_type": "thumbs_down",
                "message_context": "Question about API",
                "feedback_text": "Response was not helpful",
            }

            response = client_with_mocked_db.post(
                "/ratings/submit",
                json=rating_data,
                headers={"Authorization": "Bearer test-token"},
                params={"session_id": "session-123", "event_id": "event-456"},  # Test query params fallback
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["rating_type"] == "thumbs_down"

            # Verify rating value is -1 for thumbs down
            rating_obj = mock_db_session.add.call_args[0][0]
            assert rating_obj.rating_value == -1

    @pytest.mark.asyncio
    async def test_submit_rating_without_auth(self, client_with_mocked_db):
        """Test rating submission without authentication"""
        rating_data = {"rating_type": "thumbs_up"}

        response = client_with_mocked_db.post("/ratings/submit", json=rating_data)

        # Should be either 401 (no auth) or 403 (forbidden) - both are valid for no auth
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]

    @pytest.mark.asyncio
    async def test_submit_rating_long_context(self, client_with_mocked_db, mock_db_session, mock_user):
        """Test rating with very long context (should be truncated)"""
        from src.app.auth.jwt_utils import TokenData

        token_data = TokenData(
            user_id=str(mock_user.id), email=mock_user.email, organisation_id=str(mock_user.organisation_id)
        )

        with patch("src.app.auth.dependencies.verify_token", return_value=token_data):
            # Mock user lookup for active user check
            user_result = MagicMock()
            user_result.scalar_one_or_none.return_value = mock_user
            mock_db_session.execute.return_value = user_result

            long_context = "x" * 1000  # 1000 characters
            rating_data = {
                "rating_type": "thumbs_up",
                "message_context": long_context,
            }

            response = client_with_mocked_db.post(
                "/ratings/submit", json=rating_data, headers={"Authorization": "Bearer test-token"}
            )

            assert response.status_code == status.HTTP_200_OK

            # Verify context was truncated to 500 chars
            rating_obj = mock_db_session.add.call_args[0][0]
            assert len(rating_obj.message_context) == 500
