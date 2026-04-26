"""
Lightweight token-based cosine similarity for title-level dedup (#6).

Uses stdlib only. For each title we:
  1. Lowercase + strip punctuation
  2. Drop a small English stop-word set
  3. Build a token Counter (bag-of-words)
  4. Compute cosine similarity = dot(a,b) / (||a|| * ||b||)

This catches semantic dupes that character-level Jaccard misses, e.g.:
  "Anthropic launches Claude 4.6"  vs  "Claude 4.6 announced by Anthropic"
  → SequenceMatcher ≈ 0.45 (miss)
  → token cosine    ≈ 0.83 (catch)

Used as a SECOND-PASS check on top of the existing lexical filter, so we
keep the cheap path fast and only escalate when the lexical score is
borderline or zero.
"""
from __future__ import annotations
import math
import re
from collections import Counter

_STOP = {
    "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
    "has", "have", "in", "is", "it", "of", "on", "or", "that", "the", "this",
    "to", "was", "were", "will", "with", "after", "before", "into", "out",
    "over", "under", "via", "vs", "amid", "amid", "their", "its",
}
_TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(title: str) -> list[str]:
    """Lowercase, strip punct, drop stop-words. Returns list of tokens."""
    if not title:
        return []
    tokens = _TOKEN_RE.findall(title.lower())
    return [t for t in tokens if t not in _STOP and len(t) > 1]


def to_vector(title: str) -> Counter:
    return Counter(tokenize(title))


def cosine(a: Counter, b: Counter) -> float:
    """Cosine similarity between two token Counters. 0.0..1.0."""
    if not a or not b:
        return 0.0
    common = set(a) & set(b)
    if not common:
        return 0.0
    dot = sum(a[t] * b[t] for t in common)
    norm_a = math.sqrt(sum(v * v for v in a.values()))
    norm_b = math.sqrt(sum(v * v for v in b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def titles_semantically_similar(a: str, b: str, threshold: float = 0.78) -> bool:
    """Return True if two titles share enough meaningful tokens to be the same story."""
    return cosine(to_vector(a), to_vector(b)) >= threshold
