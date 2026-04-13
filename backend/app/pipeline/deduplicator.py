import difflib
import re
from urllib.parse import urlparse, urlencode, parse_qs


def normalize_url(url: str) -> str:
    """Strip UTM params, trailing slashes, normalize protocol."""
    try:
        parsed = urlparse(url.lower())
        # Remove UTM and tracking params
        filtered_params = {
            k: v for k, v in parse_qs(parsed.query).items()
            if not k.startswith(("utm_", "ref", "source", "campaign"))
        }
        query = urlencode(filtered_params, doseq=True)
        normalized = parsed._replace(
            scheme="https",
            netloc=parsed.netloc.removeprefix("www."),
            path=parsed.path.rstrip("/"),
            query=query,
            fragment="",
        ).geturl()
        return normalized
    except Exception:
        return url


def titles_are_similar(a: str, b: str, threshold: float = 0.85) -> bool:
    """Return True if two titles are likely the same story republished."""
    a = re.sub(r"[^\w\s]", "", a.lower())
    b = re.sub(r"[^\w\s]", "", b.lower())
    ratio = difflib.SequenceMatcher(None, a, b).ratio()
    return ratio >= threshold
