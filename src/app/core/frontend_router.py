from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from src.app.utils.config_helpers import config_helper

BASEDIR = Path(__file__).resolve().parent

frontend_router = APIRouter()

templates = Jinja2Templates(directory=f"{BASEDIR}/templates")


@frontend_router.get("/", response_class=HTMLResponse)
async def frontend(request: Request):
    """Serve the chat frontend"""
    context = {"request": request, **config_helper.frontend_config}
    return templates.TemplateResponse(request, "base.html", context)


@frontend_router.get("/reset-password", response_class=HTMLResponse)
async def reset_password_page(request: Request):
    """Serve the password reset page"""
    context = {
        "request": request,
        "organisation_name": config_helper.app_info["organisation_name"],
    }
    return templates.TemplateResponse(request, "reset-password.html", context)
