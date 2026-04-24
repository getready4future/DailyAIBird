"""
NVIDIA Build API multiplex client.
Maintains a fallback chain across models — each has its own rate-limit bucket,
so 429 on model N → try model N+1. Effective RPM ≈ sum of all model limits.
"""
import logging
import random
import time
from dataclasses import dataclass, field

import httpx

logger = logging.getLogger(__name__)

NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

DEFAULT_CHAIN = [
    "deepseek-ai/deepseek-v3.2",
    "meta/llama-3.3-70b-instruct",
    "moonshotai/kimi-k2.5",
    "mistralai/mistral-medium-3-instruct",
]


@dataclass
class _ModelState:
    name: str
    cooldown_until: float = field(default=0.0)


class NvidiaMultiplex:
    """
    Synchronous fallback chain across NVIDIA models.
    Rules:
    - 429 → cool model down for `cooldown_sec`, try next in chain
    - 5xx / timeout → one retry on same model, then next
    - 4xx (non-429) → raise immediately (bad payload / auth)
    """

    def __init__(
        self,
        api_key: str,
        chain: list[str] | None = None,
        cooldown_sec: float = 30.0,
    ):
        self.api_key = api_key
        self.models = [_ModelState(m) for m in (chain or DEFAULT_CHAIN)]
        self.cooldown = cooldown_sec
        self._client = httpx.Client(timeout=30)

    def _available(self) -> list[_ModelState]:
        now = time.monotonic()
        return [m for m in self.models if m.cooldown_until <= now]

    def _post(self, model: str, messages: list[dict], max_tokens: int, temperature: float):
        return self._client.post(
            NVIDIA_URL,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
        )

    def chat(
        self,
        messages: list[dict],
        max_tokens: int = 512,
        temperature: float = 0.7,
    ) -> tuple[str, str]:
        """
        Returns (reply_text, model_name).
        Raises RuntimeError if all models are exhausted.
        """
        candidates = self._available() or self.models
        last_err = "no models tried"

        for m in candidates:
            try:
                r = self._post(m.name, messages, max_tokens, temperature)

                if r.status_code == 200:
                    content = r.json()["choices"][0]["message"]["content"]
                    logger.info("NVIDIA [%s] responded OK", m.name)
                    return content, m.name

                if r.status_code == 429:
                    m.cooldown_until = time.monotonic() + self.cooldown
                    logger.warning("NVIDIA [%s] 429 — cooldown %ds", m.name, self.cooldown)
                    last_err = f"429 on {m.name}"
                    continue

                # 4xx non-rate → programming error, raise immediately
                if 400 <= r.status_code < 500:
                    raise RuntimeError(
                        f"NVIDIA {r.status_code} on {m.name}: {r.text[:300]}"
                    )

                # 5xx → one retry with jitter
                jitter = 0.5 + random.random() * 0.5
                time.sleep(jitter)
                r2 = self._post(m.name, messages, max_tokens, temperature)
                if r2.status_code == 200:
                    content = r2.json()["choices"][0]["message"]["content"]
                    logger.info("NVIDIA [%s] responded OK (5xx retry)", m.name)
                    return content, m.name
                last_err = f"{r2.status_code} on {m.name} (5xx retry)"

            except httpx.TimeoutException:
                last_err = f"timeout on {m.name}"
                logger.warning("NVIDIA [%s] timeout", m.name)
                continue

        raise RuntimeError(f"All NVIDIA models exhausted: {last_err}")

    def close(self) -> None:
        self._client.close()
