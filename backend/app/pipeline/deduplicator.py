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


def group_similar_titles(titles: list[str], threshold: float = 0.65) -> list[list[int]]:
    """Group title indices that are near-duplicates. Returns list of groups (each group ≥ 2 items)."""
    n = len(titles)
    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(n):
        for j in range(i + 1, n):
            if titles_are_similar(titles[i], titles[j], threshold):
                ri, rj = find(i), find(j)
                if ri != rj:
                    parent[ri] = rj

    clusters: dict[int, list[int]] = {}
    for i in range(n):
        root = find(i)
        clusters.setdefault(root, []).append(i)

    return [group for group in clusters.values() if len(group) > 1]
