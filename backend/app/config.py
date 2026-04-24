from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./data/dailyaibird.db"
    ADMIN_SECRET: str = "change-me-in-production"

    # NVIDIA Build API (primary — multiplex fallback chain)
    NVIDIA_API_KEY: str = ""

    # Fallback: OpenAI-compatible provider (Groq, Gemini, etc.)
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
