import os

from loguru import logger


class ScenarioService:
    """Simple service for scenario - frontend connects directly to external agent"""

    def __init__(self):
        # Environment variables are available but not used since
        # the frontend connects directly to the external agent
        self.agent_base = os.getenv("AGENT_BASE", "http://localhost:5055")
        self.agent_scenario_url = os.getenv("AGENT_SCENARIO_URL", "/scenario")
        self.agent_ws_base = os.getenv("AGENT_WS_BASE", "ws://localhost:5055/ws")

        logger.info(f"ScenarioService initialized - frontend will connect to: {self.agent_ws_base}")

    # No methods needed - frontend handles everything directly
