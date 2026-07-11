"""Lightweight in-memory rate limiting (per client IP + path).

Mitigates brute-force / credential-stuffing on sensitive endpoints (OWASP A07).
In-process only — fine for a single instance; move to Redis if you scale out.
"""
import os
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

_hits: dict[str, deque] = defaultdict(deque)


def _enabled() -> bool:
    # Off during tests (pytest sets PYTEST_CURRENT_TEST) or when explicitly disabled.
    if os.environ.get("PYTEST_CURRENT_TEST"):
        return False
    return os.environ.get("RATE_LIMIT_ENABLED", "true").lower() not in ("false", "0", "no")


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(max_requests: int = 10, window_seconds: int = 60):
    """Dependency factory: at most `max_requests` per `window_seconds` per IP+path."""

    async def _dep(request: Request):
        if not _enabled():
            return
        now = time.time()
        key = f"{_client_ip(request)}:{request.url.path}"
        dq = _hits[key]
        while dq and dq[0] <= now - window_seconds:
            dq.popleft()
        if len(dq) >= max_requests:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Demasiados intentos. Espera unos segundos e inténtalo de nuevo.",
            )
        dq.append(now)
        # Opportunistic cleanup so the map doesn't grow unbounded.
        if len(_hits) > 5000:
            for k in [k for k, v in list(_hits.items()) if not v]:
                _hits.pop(k, None)

    return _dep
