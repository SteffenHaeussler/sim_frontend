import os
from loguru import logger


class ScenarioService:
    """Simple service for scenario - frontend connects directly to external agent"""
    
    def __init__(self):
        # Environment variables are available but not used since
        # the frontend connects directly to the external agent
        self.agent_base = os.getenv("agent_base", "http://localhost:5055")
        self.agent_scenario_url = os.getenv("agent_scenario_url", "/scenario")
        self.agent_ws_base = os.getenv("agent_ws_base", "ws://localhost:5055/ws")
        
        logger.info(f"ScenarioService initialized - frontend will connect to: {self.agent_ws_base}")
    
    # No methods needed - frontend handles everything directly