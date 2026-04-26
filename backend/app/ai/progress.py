"""
Thread-safe in-memory event store for scrape progress streaming.
Pipeline emits events here; SSE endpoint polls and streams to client.
Events are persisted to the pipeline_runs table at finish().
"""
import json
import threading
import time

_lock = threading.Lock()
_events: list[dict] = []
_active = False
_current_run_id: int | None = None


def start() -> None:
    global _events, _active
    with _lock:
        _events = []
        _active = True


def set_run_id(run_id: int) -> None:
    global _current_run_id
    with _lock:
        _current_run_id = run_id


def emit(message: str, kind: str = "info", **extra) -> None:
    with _lock:
        _events.append({"message": message, "kind": kind, "ts": time.time(), **extra})


def finish() -> None:
    global _active
    emit("Scraping completed!", kind="done")
    with _lock:
        _active = False
        run_id = _current_run_id
        snapshot = list(_events)
    if run_id is not None:
        _persist_events(run_id, snapshot)


def get_events(since: int = 0) -> list[dict]:
    with _lock:
        return list(_events[since:])


def is_active() -> bool:
    with _lock:
        return _active


def _persist_events(run_id: int, events: list[dict]) -> None:
    """Bulk-write event list to pipeline_runs.events_json."""
    try:
        from app.database import SessionLocal
        from app.models.pipeline_run import PipelineRun
        db = SessionLocal()
        try:
            row = db.query(PipelineRun).filter(PipelineRun.id == run_id).first()
            if row:
                row.events_json = json.dumps(events)
                db.commit()
        finally:
            db.close()
    except Exception:
        pass  # Never crash the pipeline due to persistence failure
