import logging
import time

from openai import OpenAI, RateLimitError

from app.config import settings

logger = logging.getLogger(__name__)

_client: OpenAI | None = None

# Exposed so digest_generator.py can log the model name
MODEL = settings.AI_MODEL


def get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=settings.AI_API_KEY,
            base_url=settings.AI_BASE_URL,
            default_headers={
                # OpenRouter uses these for leaderboard / abuse tracking
                "HTTP-Referer": settings.AI_SITE_URL,
                "X-Title": settings.AI_SITE_NAME,
            },
        )
    return _client


def call_claude(prompt: str, max_tokens: int = 1024) -> str:
    """
    Single AI call. Name kept as call_claude so processor.py / digest_generator.py
    don't need to change.
    """
    client = get_client()
    try:
        response = client.chat.completions.create(
            model=settings.AI_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content or ""
    except RateLimitError:
        logger.warning("AI rate limit hit — waiting 30s before retry")
        time.sleep(30)
        response = client.chat.completions.create(
            model=settings.AI_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content or ""
    except Exception as exc:
        logger.error("AI API error: %s", exc)
        raise
