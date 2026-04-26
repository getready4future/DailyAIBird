"""
Thread-safe in-memory event store for scrape progress streaming.
Pipeline emits events here; SSE endpoint polls and streams to client.
"""
import threading
import time

_lock = threading.Lock()
_events: list[dict] = []
_active = False


def start() -> None:
    global _events, _active
    with _lock:
        _events = []
        _active = True


def emit(message: str, kind: str = "info", **extra) -> None:
    with _lock:
        _events.append({"message": message, "kind": kind, "ts": time.time(), **extra})


def finish() -> None:
    global _active
    emit("Scraping completed!", kind="done")
    with _lock:
        _active = False


def get_events(since: int = 0) -> list[dict]:
    with _lock:
        return list(_events[since:])


def is_active() -> bool:
    with _lock:
        return _active
