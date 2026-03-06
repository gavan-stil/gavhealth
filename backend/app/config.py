"""Application configuration via environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://localhost:5432/gavhealth"

    # Auth
    api_key: str = "dev-api-key"

    # Claude API
    anthropic_api_key: str = ""

    # Withings OAuth
    withings_client_id: str = ""
    withings_client_secret: str = ""
    withings_access_token: str = ""
    withings_refresh_token: str = ""

    # CORS — stored as comma-separated string to avoid pydantic-settings
    # list-parsing issues with env vars.  Split in main.py if needed.
    frontend_url: str = "*"
    cors_allow_origins: str = "*"

    # App
    environment: str = "development"
    rate_limit_per_minute: int = 100

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
