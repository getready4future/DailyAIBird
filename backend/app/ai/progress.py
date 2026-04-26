"""
Multi-run thread-safe in-memory event store with persistence.

Each pipeline invocation registers its own run_id (an int — typically the
PipelineRun row id). All emit/get/finish operations are scoped to that run_id.
The current run for a given async/thread context is tracked via a ContextVar
so call sites don't have to thread the run_id through every function.

Persistence model:
  - At start(), the run is registered in memory.
  - emit() pushes events into that run's in-memory list.
  - A background flusher thread writes events_json to the DB every
    PERSIST_INTERVAL_SEC so logs survive a server crash.
  - finish() does a final synchronous flush.
"""
import contextvars
import json
import logging
import threading
import time

logger = logging.getLogger(__name__)

PERSIST_INTERVAL_SEC = 5.0  # flush every 5s during a live run

_lock = threading.Lock()

# run_id -> {
#   "events": [...],           # in-memory event list
#   "active": bool,             # currently running
#   "cancel": bool,             # cancellation requested
#   "input_tokens": int,        # cost accumulator (cumulative)
#   "output_tokens": int,
#   "started_at": float,        # time.time()
#   "last_flushed_idx": int,    # how many events have been written to DB
# }
_runs: dict[int, dict] = {}

# Async/thread-local current run id
_current_run_id: contextvars.ContextVar[int | None] = contextvars.ContextVar(
    "current_run_id", default=None
)

# Background flusher thread state
_flusher_thread: threading.Thread | None = None
_flusher_stop = threading.Event()


# ── Run lifecycle ──────────────────────────────────────────────────────────────

def start(run_id: int) -> None:
    """Register a new pipeline run. Sets ContextVar so emit() picks it up."""
    with _lock:
        _runs[run_id] = {
            "events": [],
            "active": True,
            "cancel": False,
            "input_tokens": 0,
            "output_tokens": 0,
            "started_at": time.time(),
            "last_flushed_idx": 0,
        }
    _current_run_id.set(run_id)
    _ensure_flusher_running()


def finish(run_id: int | None = None) -> None:
    """Mark the run finished, emit done event, and flush events to DB."""
    rid = run_id if run_id is not None else _current_run_id.get()
    if rid is None:
        return
    emit("Scraping completed!", kind="done")
    with _lock:
        run = _runs.get(rid)
        if run is None:
            return
        run["active"] = False
        snapshot = list(run["events"])
        in_tok = run["input_tokens"]
        out_tok = run["output_tokens"]
    _persist_events(rid, snapshot, in_tok, out_tok, final=True)


def request_cancel(run_id: int) -> bool:
    """Request cancellation of a running pipeline. Returns True if the run exists."""
    with _lock:
        run = _runs.get(run_id)
        if run is None or not run["active"]:
            return False
        run["cancel"] = True
    emit("Cancellation requested by user", kind="info", run_id=run_id)
    return True


def is_cancelled(run_id: int | None = None) -> bool:
    rid = run_id if run_id is not None else _current_run_id.get()
    if rid is None:
        return False
    with _lock:
        run = _runs.get(rid)
        return bool(run and run.get("cancel"))


def is_active(run_id: int | None = None) -> bool:
    rid = run_id if run_id is not None else _current_run_id.get()
    if rid is None:
        return False
    with _lock:
        run = _runs.get(rid)
        return bool(run and run["active"])


def list_active_run_ids() -> list[int]:
    with _lock:
        return [rid for rid, r in _runs.items() if r["active"]]


# ── Event I/O ──────────────────────────────────────────────────────────────────

def emit(message: str, kind: str = "info", **extra) -> None:
    """Append an event to the current run's event list."""
    rid = _current_run_id.get()
    if rid is None:
        # Fall back to the most recent active run, if any (covers contexts
        # where ContextVar didn't propagate, e.g. raw threads).
        with _lock:
            actives = [r for r, v in _runs.items() if v["active"]]
            if not actives:
                return
            rid = max(actives)
    with _lock:
        run = _runs.get(rid)
        if run is None:
            return
        run["events"].append({"message": message, "kind": kind, "ts": time.time(), **extra})


def get_events(run_id: int | None = None, since: int = 0) -> list[dict]:
    rid = run_id if run_id is not None else _current_run_id.get()
    if rid is None:
        return []
    with _lock:
        run = _runs.get(rid)
        return list(run["events"][since:]) if run else []


# ── Cost tracking ──────────────────────────────────────────────────────────────

def add_usage(input_tokens: int, output_tokens: int) -> None:
    """Accumulate token usage for the current run. Called from client.py."""
    rid = _current_run_id.get()
    if rid is None:
        return
    with _lock:
        run = _runs.get(rid)
        if run is None:
            return
        run["input_tokens"] += int(input_tokens or 0)
        run["output_tokens"] += int(output_tokens or 0)


def get_usage(run_id: int | None = None) -> tuple[int, int]:
    rid = run_id if run_id is not None else _current_run_id.get()
    if rid is None:
        return (0, 0)
    with _lock:
        run = _runs.get(rid)
        if run is None:
            return (0, 0)
        return (run["input_tokens"], run["output_tokens"])


# ── Background flusher ────────────────────────────────────────────────────────

def _ensure_flusher_running() -> None:
    global _flusher_thread
    if _flusher_thread is not None and _flusher_thread.is_alive():
        return
    _flusher_stop.clear()
    _flusher_thread = threading.Thread(target=_flush_loop, daemon=True, name="progress-flusher")
    _flusher_thread.start()


def _flush_loop() -> None:
    """Periodically write events_json + token usage for active runs to DB."""
    while not _flusher_stop.wait(PERSIST_INTERVAL_SEC):
        try:
            with _lock:
                snapshots = []
                for rid, run in list(_runs.items()):
                    if not run["events"]:
                        continue
                    if len(run["events"]) == run["last_flushed_idx"]:
                        continue
                    snapshots.append((rid, list(run["events"]),
                                      run["input_tokens"], run["output_tokens"]))
                    run["last_flushed_idx"] = len(run["events"])
            for rid, ev, in_tok, out_tok in snapshots:
                _persist_events(rid, ev, in_tok, out_tok, final=False)

            # Garbage-collect long-finished runs (keep last 60s after finish)
            now = time.time()
            with _lock:
                for rid in list(_runs.keys()):
                    run = _runs[rid]
                    if not run["active"] and run["events"]:
                        last_ts = run["events"][-1]["ts"]
                        if now - last_ts > 60:
                            del _runs[rid]
        except Exception as exc:
            logger.warning("Flusher iteration failed: %s", exc)


def _persist_events(run_id: int, events: list[dict], input_tokens: int,
                    output_tokens: int, final: bool = False) -> None:
    """Bulk-write event list and token totals to pipeline_runs row."""
    try:
        from app.database import SessionLocal
        from app.models.pipeline_run import PipelineRun
        db = SessionLocal()
        try:
            row = db.query(PipelineRun).filter(PipelineRun.id == run_id).first()
            if row:
                row.events_json = json.dumps(events)
                row.input_tokens = input_tokens
                row.output_tokens = output_tokens
                db.commit()
        finally:
            db.close()
    except Exception as exc:
        logger.debug("Persist failed for run %s (final=%s): %s", run_id, final, exc)


# ── Backwards-compat shims (single-run callers) ────────────────────────────────

def set_run_id(run_id: int) -> None:
    """Legacy alias — kept so older call sites still work. Prefer start()."""
    _current_run_id.set(run_id)
