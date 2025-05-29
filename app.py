import asyncio
import os
import threading
import uuid

import httpx
import streamlit as st
import websockets
from dotenv import load_dotenv
from loguru import logger

# Load .env file
load_dotenv()

API_URL = os.getenv("agent_api_base") + os.getenv("agent_api_url")

WS_BASE = os.getenv("agent_ws_base")


async def listen_to_websocket(session_id):
    ws_url = f"{WS_BASE}?session_id={session_id}"
    try:
        async with websockets.connect(ws_url) as websocket:
            while True:
                msg = await websocket.recv()
                st.write(f"{msg}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)


def trigger_event(session_id, question):
    """Fire-and-forget HTTP GET call."""

    def send_request():
        try:
            httpx.get(
                API_URL,
                params={
                    "q_id": session_id,
                    "question": question,
                },
                timeout=2,
            )
        except Exception as e:
            logger.error(f"Trigger request failed: {e}")

    threading.Thread(target=send_request, daemon=True).start()


def main():
    st.title("WebSocket Listener")

    st.session_state.session_id = uuid.uuid4()
    st.write(f"Session ID: `{st.session_state.session_id}`")

    question = st.text_input("Enter your question:", "")
    if st.button("ASk question:") and question:
        trigger_event(st.session_state.session_id, question)

        asyncio.run(listen_to_websocket(st.session_state.session_id))


if __name__ == "__main__":
    main()
