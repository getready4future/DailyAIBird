from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./data/dailyaibird.db"
    ADMIN_SECRET: str = "change-me-in-production"

    # Set in .env to fix the admin password on fresh installs.
    # If empty, a random password is generated and printed once at startup.
    ADMIN_PASSWORD: str = ""

    # Comma-separated allowed CORS origins.  Never use "*" in production.
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # OpenRouter — primary provider (Gemma, Claude, etc.)
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "google/gemma-4-31b-it:free"

    # NVIDIA Build API — secondary (multiplex fallback chain)
    NVIDIA_API_KEY: str = ""

    # Generic OpenAI-compatible fallback (Groq, etc.)
    AI_API_KEY: str = ""
    AI_MODEL: str = "llama-3.1-8b-instant"
    AI_BASE_URL: str = "https://api.groq.com/openai/v1"
    AI_SITE_URL: str = "https://dailyaibird.com"
    AI_SITE_NAME: str = "Daily AI Bird"

    SCRAPE_SCHEDULE_HOUR: int = 6
    DIGEST_SCHEDULE_HOUR: int = 7
    MAX_ARTICLES_PER_SOURCE: int = 20
    AI_BATCH_SIZE: int = 5
    PLAYWRIGHT_HEADLESS: bool = True

    TWITTER_BEARER_TOKEN: str = ""
    REDDIT_USER_AGENT: str = "DailyAIBird/1.0"

    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"


settings = Settings()
