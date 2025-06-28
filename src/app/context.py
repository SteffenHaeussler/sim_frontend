from contextvars import ContextVar

ctx_session_id = ContextVar("session_id", default="-")
