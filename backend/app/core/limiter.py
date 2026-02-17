"""Rate limiter for API. Optional: ohne slowapi läuft die App ohne Rate-Limiting."""
import uuid
from app.config import settings

try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address

    def _rate_limit_key(request):
        if settings.ENVIRONMENT == "test":
            return str(uuid.uuid4())
        return get_remote_address(request)

    limiter = Limiter(key_func=_rate_limit_key)
    RATE_LIMIT_ENABLED = True
except ImportError:
    RATE_LIMIT_ENABLED = False

    class _DummyLimiter:
        def limit(self, *args, **kwargs):
            def decorator(f):
                return f
            return decorator

    limiter = _DummyLimiter()
