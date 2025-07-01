import json
import logging
import sys

from loguru import logger

from src.app.context import ctx_session_id, ctx_event_id, ctx_request_id


def tracking_filter(record):
    """Add all tracking IDs to log records"""
    record["session_id"] = ctx_session_id.get()
    record["event_id"] = ctx_event_id.get()
    record["request_id"] = ctx_request_id.get()
    return True  # Always include the record


class InterceptHandler(logging.Handler):
    """
    Default handler from examples in loguru documentaion.
    See https://loguru.readthedocs.io/en/stable/overview.html#entirely-compatible-with-standard-logging
    """

    def emit(self, record: logging.LogRecord):
        # Get corresponding Loguru level if it exists
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        # Find caller from where originated the logged message
        frame, depth = logging.currentframe(), 2
        while frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(
            level, record.getMessage()
        )


def sink_serializer(message):
    record = message.record
    simplified = {
        "level": record["level"].name,
        "message": record["message"],
        "timestamp": record["time"].timestamp(),
        "session_id": record["session_id"],
        "event_id": record["event_id"],
        "request_id": record["request_id"],
    }
    serialized = json.dumps(simplified)
    print(serialized, file=sys.stdout)


def setup_logger(config_name, json_serialize=True):
    intercept_handler = InterceptHandler()

    loggers = (
        logging.getLogger(name)
        for name in logging.root.manager.loggerDict
        if name.startswith("uvicorn.")
    )
    for uvicorn_logger in loggers:
        uvicorn_logger.handlers = [intercept_handler]

    if config_name == "prod":
        service_log_level = logging.ERROR
    elif config_name == "staging":
        service_log_level = logging.INFO
    else:
        service_log_level = logging.DEBUG

    if json_serialize:
        logger.configure(
            handlers=[
                {
                    "sink": sink_serializer,
                    "level": service_log_level,
                    "filter": tracking_filter,
                }
            ]
        )

    else:
        fmt = "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <red>S:{session_id}</red> | <blue>E:{event_id}</blue> | <magenta>R:{request_id}</magenta> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>"

        logger.configure(
            handlers=[
                {
                    "sink": sys.stdout,
                    "level": service_log_level,
                    "format": fmt,
                    "filter": tracking_filter,
                }
            ]
        )
