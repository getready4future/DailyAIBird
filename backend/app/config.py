from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./data/dailyaibird.db"
    ANTHROPIC_API_KEY: str = ""
    ADMIN_SECRET: str = "change-me-in-production"

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
