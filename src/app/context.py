from contextvars import ContextVar

ctx_session_id = ContextVar("session_id", default="-")
ctx_event_id = ContextVar("event_id", default="-")
ctx_request_id = ContextVar("request_id", default="-")
