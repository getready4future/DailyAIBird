"""Persistent config for the AI model chain (stored in data/model_chain.json)."""
import json
import os

CHAIN_FILE = "data/model_chain.json"

DEFAULT_NVIDIA_CHAIN = [
    "deepseek-ai/deepseek-v3.1-terminus",
    "moonshotai/kimi-k2-instruct-0905",
    "meta/llama-3.3-70b-instruct",
    "mistralai/mistral-large-3-675b-instruct-2512",
    "z-ai/glm4.7",
    "moonshotai/kimi-k2.5",
    "meta/llama-4-maverick-17b-128e-instruct",
    "mistralai/mistral-medium-3-instruct",
    "bytedance/seed-oss-36b-instruct",
    "google/gemma-3-27b-it",
]


def load() -> dict:
    if os.path.exists(CHAIN_FILE):
        try:
            with open(CHAIN_FILE) as f:
                return json.load(f)
        except Exception:
            pass
    return {"nvidia_chain": list(DEFAULT_NVIDIA_CHAIN), "openrouter_model": None}


def save(config: dict) -> None:
    os.makedirs(os.path.dirname(CHAIN_FILE), exist_ok=True)
    with open(CHAIN_FILE, "w") as f:
        json.dump(config, f, indent=2)
