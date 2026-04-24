import logging
import time
from typing import Generator

from app.config import settings

logger = logging.getLogger(__name__)

_nvidia_mx              = None
_openai_client          = None
_openrouter_client      = None

# Public aliases for admin router
_multiplex              = None   # NVIDIA NvidiaMultiplex instance
_openrouter_ok          = True   # last OpenRouter call succeeded
_openrouter_model_override: str | None = None   # runtime override (admin panel)

# Time-based cooldown — after 429 skip OpenRouter for this many seconds
_openrouter_cooldown_until: float = 0.0
_OPENROUTER_COOLDOWN_SEC: float = 60.0

# Runtime provider selection: "openrouter" | "nvidia" | "generic"
_active_provider: str = ""

# Backward-compat export used by digest_generator.py to log the model name
MODEL = settings.OPENROUTER_MODEL if settings.OPENROUTER_API_KEY else settings.AI_MODEL


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


def get_openrouter_model() -> str:
    return _openrouter_model_override or settings.OPENROUTER_MODEL


def set_openrouter_model(model: str) -> None:
    global _openrouter_model_override
    _openrouter_model_override = model
    logger.info("OpenRouter model set to: %s", model)


def apply_saved_chain() -> None:
    """Load persisted chain config and apply to live instances (called at startup)."""
    global _openrouter_model_override
    from app.ai.chain_config import load
    config = load()
    if config.get("openrouter_model"):
        _openrouter_model_override = config["openrouter_model"]
    if _nvidia_mx and config.get("nvidia_chain"):
        from app.ai.nvidia_multiplex import _ModelState
        _nvidia_mx.models = [_ModelState(m) for m in config["nvidia_chain"]]


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
        from app.ai.chain_config import load
        from app.ai.nvidia_multiplex import NvidiaMultiplex
        config = load()
        chain  = config.get("nvidia_chain") or None
        _nvidia_mx = NvidiaMultiplex(api_key=settings.NVIDIA_API_KEY, chain=chain)
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
    global _openrouter_ok, _openrouter_cooldown_until
    from openai import RateLimitError
    client = _get_openrouter()
    try:
        response = client.chat.completions.create(
            model=get_openrouter_model(),
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
            timeout=90,
        )
        _openrouter_ok = True
        _openrouter_cooldown_until = 0.0
        return response.choices[0].message.content or ""
    except RateLimitError as exc:
        _openrouter_ok = False
        _openrouter_cooldown_until = time.monotonic() + _OPENROUTER_COOLDOWN_SEC
        logger.warning("OpenRouter 429 — cooling down for %ds", _OPENROUTER_COOLDOWN_SEC)
        raise RuntimeError(f"OpenRouter rate limit: {exc}") from exc
    except Exception as exc:
        _openrouter_ok = False
        _openrouter_cooldown_until = time.monotonic() + _OPENROUTER_COOLDOWN_SEC
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
    Calls the active provider first, falls back to the others.
    If OpenRouter is in a 429 cooldown window, it is moved to the end of the
    order so NVIDIA (or generic) handles the call immediately.
    """
    provider = get_active_provider()

    if provider == "openrouter":
        order = ["openrouter", "nvidia", "generic"]
    elif provider == "nvidia":
        order = ["nvidia", "openrouter", "generic"]
    else:
        order = ["generic", "openrouter", "nvidia"]

    # Demote OpenRouter to last position while it's in cooldown
    if time.monotonic() < _openrouter_cooldown_until:
        remaining = round(_openrouter_cooldown_until - time.monotonic())
        logger.debug("OpenRouter in cooldown (%ds remaining) — trying other providers first", remaining)
        order = [p for p in order if p != "openrouter"] + ["openrouter"]

    last_exc: Exception | None = None
    for p in order:
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
        model  = get_openrouter_model()
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
        logger.warning("%s rate limit (stream) — 30s retry", label)
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
