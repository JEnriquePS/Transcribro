import io
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from main import app


@pytest.fixture()
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestHealthCheck:
    @pytest.mark.asyncio
    async def test_health_returns_response(self, client):
        response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ("ok", "degraded")
        assert "checks" in data
        assert "ffmpeg" in data["checks"]
        assert "whisper_cli" in data["checks"]


class TestListModels:
    @pytest.mark.asyncio
    async def test_list_models_returns_known_models(self, client):
        response = await client.get("/api/models")
        assert response.status_code == 200
        data = response.json()
        assert "models" in data
        assert "default" in data
        names = [m["name"] for m in data["models"]]
        assert "large-v3" in names
        assert "tiny" in names


class TestUploadValidation:
    @pytest.mark.asyncio
    async def test_rejects_invalid_extension(self, client):
        file_content = b"fake content"
        response = await client.post(
            "/api/transcribe",
            files={"file": ("test.exe", io.BytesIO(file_content), "application/octet-stream")},
            data={"model": "tiny", "language": "es"},
        )
        assert response.status_code == 400
        assert "Unsupported file type" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_accepts_valid_extension(self, client, tmp_jobs_dir):
        file_content = b"fake mp4 content"

        with (
            patch("routers.transcribe.job_manager.create_job") as mock_create,
            patch("routers.transcribe.job_manager.save_uploaded_file", new_callable=AsyncMock),
            patch("routers.transcribe.job_manager.enqueue_job", new_callable=AsyncMock),
        ):
            from models.schemas import JobMetadata

            mock_create.return_value = JobMetadata(
                job_id="test123", original_filename="test.mp4"
            )

            response = await client.post(
                "/api/transcribe",
                files={"file": ("test.mp4", io.BytesIO(file_content), "video/mp4")},
                data={"model": "tiny", "language": "es"},
            )
            assert response.status_code == 202
            assert response.json()["job_id"] == "test123"


class TestJobNotFound:
    @pytest.mark.asyncio
    async def test_get_nonexistent_job(self, client):
        response = await client.get("/api/jobs/nonexistent")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent_job(self, client):
        response = await client.delete("/api/jobs/nonexistent")
        assert response.status_code == 404


class TestDownloadFormat:
    @pytest.mark.asyncio
    async def test_rejects_invalid_format(self, client):
        response = await client.get("/api/jobs/someid/download", params={"format": "pdf"})
        assert response.status_code == 400
        assert "Unsupported format" in response.json()["detail"]
