"""Lightweight login abuse protection.

The in-process store is suitable for a single worker and local development. In a
multi-worker deployment, replace the store with Redis so counters are shared.
"""
import hashlib
import os
import time
from collections import defaultdict
from threading import Lock

WINDOW_SECONDS = int(os.getenv("LOGIN_RATE_WINDOW_SECONDS", "300"))
MAX_FAILURES = int(os.getenv("LOGIN_RATE_MAX_FAILURES", "5"))
BLOCK_SECONDS = int(os.getenv("LOGIN_RATE_BLOCK_SECONDS", "180"))

_lock = Lock()
_failures = defaultdict(list)
_blocks = {}


def _key(value: str) -> str:
    return hashlib.sha256(value.strip().lower().encode("utf-8")).hexdigest()


def _cleanup(now: float) -> None:
    cutoff = now - WINDOW_SECONDS
    for key in list(_failures):
        _failures[key] = [timestamp for timestamp in _failures[key] if timestamp > cutoff]
        if not _failures[key]:
            del _failures[key]
    for key, until in list(_blocks.items()):
        if until <= now:
            del _blocks[key]


def check_login_allowed(ip: str, email: str) -> int:
    """Return remaining block seconds, or zero when the attempt is allowed."""
    now = time.monotonic()
    keys = (f"ip:{_key(ip)}", f"email:{_key(email)}")
    with _lock:
        _cleanup(now)
        remaining = max((_blocks.get(key, 0) - now for key in keys), default=0)
        return max(0, int(remaining + 0.999))


def register_login_failure(ip: str, email: str) -> int:
    """Register a failure and return the resulting block duration."""
    now = time.monotonic()
    keys = (f"ip:{_key(ip)}", f"email:{_key(email)}")
    with _lock:
        _cleanup(now)
        remaining = 0
        for key in keys:
            _failures[key].append(now)
            if len(_failures[key]) >= MAX_FAILURES:
                _blocks[key] = now + BLOCK_SECONDS
                remaining = max(remaining, BLOCK_SECONDS)
        return remaining


def clear_login_failures(ip: str, email: str) -> None:
    with _lock:
        _failures.pop(f"ip:{_key(ip)}", None)
        _failures.pop(f"email:{_key(email)}", None)


def reset_login_limits() -> None:
    """Used by tests and administrative tooling; not exposed as an API endpoint."""
    with _lock:
        _failures.clear()
        _blocks.clear()
