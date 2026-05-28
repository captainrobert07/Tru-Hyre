import threading

_local = threading.local()


def get_current_user():
    return getattr(_local, "user", None)


def get_current_request():
    return getattr(_local, "request", None)


class AuditContextMiddleware:
    """Stash the current request/user in thread-local storage for audit logging."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _local.request = request
        _local.user = getattr(request, "user", None)
        try:
            return self.get_response(request)
        finally:
            _local.request = None
            _local.user = None
