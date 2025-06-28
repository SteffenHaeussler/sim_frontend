from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from src.app.config import config_service

BASEDIR = Path(__file__).resolve().parent

frontend_router = APIRouter()

templates = Jinja2Templates(directory=f"{BASEDIR}/templates")


@frontend_router.get("/", response_class=HTMLResponse)
async def frontend(request: Request):
    """Serve the chat frontend"""
    context = {
        "request": request,
        "agent_ws_base": config_service.agent_ws_base,
        "agent_url": config_service.agent_url,
        "agent_base": config_service.agent_base,
        "api_base": config_service.api_base,
        "api_asset_url": config_service.api_asset_url,
        "api_neighbor_url": config_service.api_neighbor_url,
        "api_name_url": config_service.api_name_url,
        "api_id_url": config_service.api_id_url,
        "semantic_base": config_service.semantic_base,
        "semantic_emb_url": config_service.semantic_emb_url,
        "semantic_rank_url": config_service.semantic_rank_url,
        "semantic_search_url": config_service.semantic_search_url,
        "organisation_name": config_service.organisation_name,
    }
    return templates.TemplateResponse(request, "base.html", context)


@frontend_router.get("/reset-password", response_class=HTMLResponse)
async def reset_password_page(request: Request):
    """Serve the password reset page"""
    context = {
        "request": request,
        "organisation_name": config_service.organisation_name,
    }
    return templates.TemplateResponse(request, "reset-password.html", context)
