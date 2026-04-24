import logging
import time
from typing import Generator

from app.config import settings

logger = logging.getLogger(__name__)

_nvidia_mx         = None
_openai_client     = None
_openrouter_client = None

# Public aliases so admin router can inspect states
_multiplex     = None   # NVIDIA chain
_openrouter_ok = True   # tracks last OpenRouter call result

# Runtime provider selection: "openrouter" | "nvidia" | "generic"
# Defaults to first configured provider; admin can toggle at runtime.
_active_provider: str = ""


def _default_provider() -> str:
    if settings.OPENROUTER_API_KEY:
        return "openrouter"
    if settings.NVIDIA_API_KEY:
        return "nvidia"
    return "generic"


def get_active_provider() -> str:
    global _active_provider
    if not _active_provider:
        _active_provider = _default_provider()
    return _active_provider


def set_active_provider(provider: str) -> None:
    global _active_provider
    _active_provider = provider
    logger.info("Active AI provider switched to: %s", provider)


def _get_openrouter():
    global _openrouter_client
    if _openrouter_client is None:
        from openai import OpenAI
        _openrouter_client = OpenAI(
            api_key=settings.OPENROUTER_API_KEY,
            base_url="https://openrouter.ai/api/v1",
            default_headers={
                "HTTP-Referer": settings.AI_SITE_URL,
                "X-Title":      settings.AI_SITE_NAME,
            },
        )
    return _openrouter_client


def _get_nvidia():
    global _nvidia_mx, _multiplex
    if _nvidia_mx is None:
        from app.ai.nvidia_multiplex import NvidiaMultiplex
        _nvidia_mx = NvidiaMultiplex(api_key=settings.NVIDIA_API_KEY)
        _multiplex = _nvidia_mx
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
                "X-Title":      settings.AI_SITE_NAME,
            },
        )
    return _openai_client


def _call_openrouter(prompt: str, max_tokens: int) -> str:
    global _openrouter_ok
    from openai import RateLimitError
    client = _get_openrouter()
    try:
        response = client.chat.completions.create(
            model=settings.OPENROUTER_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
            timeout=90,
        )
        _openrouter_ok = True
        return response.choices[0].message.content or ""
    except RateLimitError as exc:
        _openrouter_ok = False
        raise RuntimeError(f"OpenRouter rate limit: {exc}") from exc
    except Exception as exc:
        _openrouter_ok = False
        raise RuntimeError(f"OpenRouter error: {exc}") from exc


def _call_nvidia(prompt: str, max_tokens: int) -> str:
    mx = _get_nvidia()
    text, model_name = mx.chat(
        messages=[{"role": "user", "content": prompt}],
        max_tokens=max_tokens,
    )
    logger.info("NVIDIA used: %s", model_name)
    return text


def _call_generic(prompt: str, max_tokens: int) -> str:
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
        logger.warning("Generic AI rate limit — waiting 30s")
        time.sleep(30)
        response = client.chat.completions.create(
            model=settings.AI_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content or ""


def call_claude(prompt: str, max_tokens: int = 1024) -> str:
    """
    Calls the active provider first, then falls back to the others.
    Active provider is controlled by set_active_provider() / admin panel.
    Name kept as call_claude so processor.py / digest_generator.py don't change.
    """
    provider = get_active_provider()

    # Build ordered list: [selected, ...rest]
    all_providers = []
    if provider == "openrouter":
        all_providers = ["openrouter", "nvidia", "generic"]
    elif provider == "nvidia":
        all_providers = ["nvidia", "openrouter", "generic"]
    else:
        all_providers = ["generic", "openrouter", "nvidia"]

    last_exc: Exception | None = None
    for p in all_providers:
        try:
            if p == "openrouter" and settings.OPENROUTER_API_KEY:
                return _call_openrouter(prompt, max_tokens)
            elif p == "nvidia" and settings.NVIDIA_API_KEY:
                return _call_nvidia(prompt, max_tokens)
            elif p == "generic" and settings.AI_API_KEY:
                return _call_generic(prompt, max_tokens)
        except Exception as exc:
            logger.warning("Provider %s failed: %s — trying next", p, exc)
            last_exc = exc
            continue

    raise RuntimeError(
        f"All AI providers failed. Last error: {last_exc}. "
        "Set OPENROUTER_API_KEY, NVIDIA_API_KEY, or AI_API_KEY."
    )


def stream_claude(prompt: str, max_tokens: int = 1024) -> Generator[str, None, None]:
    """Streaming — uses active provider (OpenRouter preferred, then generic)."""
    from openai import RateLimitError
    provider = get_active_provider()

    if provider == "openrouter" and settings.OPENROUTER_API_KEY:
        client = _get_openrouter()
        model  = settings.OPENROUTER_MODEL
        label  = "OpenRouter"
    elif settings.AI_API_KEY:
        client = _get_openai()
        model  = settings.AI_MODEL
        label  = "Generic AI"
    else:
        raise RuntimeError("No streaming AI provider configured.")

    try:
        stream = client.chat.completions.create(
            model=model, max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
        )
        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except RateLimitError:
        logger.warning("%s rate limit (stream) — waiting 30s", label)
        time.sleep(30)
        stream = client.chat.completions.create(
            model=model, max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
        )
        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except Exception as exc:
        logger.error("AI stream error: %s", exc)
        raise
