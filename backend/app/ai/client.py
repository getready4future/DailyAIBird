import logging
import time
from typing import Generator

from app.config import settings

logger = logging.getLogger(__name__)

_nvidia_mx = None
_openai_client = None

# Exposed so digest_generator.py can log the model name
MODEL = settings.AI_MODEL


def _get_nvidia():
    global _nvidia_mx
    if _nvidia_mx is None:
        from app.ai.nvidia_multiplex import NvidiaMultiplex
        _nvidia_mx = NvidiaMultiplex(api_key=settings.NVIDIA_API_KEY)
    return _nvidia_mx


def _get_openai():
    global _openai_client
    if _openai_client is None:
        from openai import OpenAI
        _openai_client = OpenAI(
            api_key=settings.AI_API_KEY,
            base_url=settings.AI_BASE_URL,
            default_headers={
                "HTTP-Referer": settings.AI_SITE_URL,
                "X-Title": settings.AI_SITE_NAME,
            },
        )
    return _openai_client


def call_claude(prompt: str, max_tokens: int = 1024) -> str:
    """
    Single AI call. Uses NVIDIA multiplex if NVIDIA_API_KEY is set,
    otherwise falls back to OpenAI-compatible provider (Groq, Gemini, etc.).
    Name kept as call_claude so processor.py / digest_generator.py don't need to change.
    """
    if settings.NVIDIA_API_KEY:
        mx = _get_nvidia()
        text, _model = mx.chat(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
        )
        return text

    # Fallback: Groq / Gemini / OpenRouter
    from openai import RateLimitError
    client = _get_openai()
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


def stream_claude(prompt: str, max_tokens: int = 1024) -> Generator[str, None, None]:
    """Stream AI response token-by-token. NVIDIA multiplex does not support streaming yet."""
    from openai import RateLimitError
    client = _get_openai()
    try:
        stream = client.chat.completions.create(
            model=settings.AI_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
        )
        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except RateLimitError:
        logger.warning("AI rate limit hit (stream) — waiting 30s before retry")
        time.sleep(30)
        stream = client.chat.completions.create(
            model=settings.AI_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
        )
        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except Exception as exc:
        logger.error("AI API error (stream): %s", exc)
        raise
