"""Backend entrypoint.

Run with:  uvicorn server:app --host 0.0.0.0 --port 8001
The application is assembled in app.main; this module keeps the historical
`server:app` import path stable.
"""
from app.main import app  # noqa: F401
