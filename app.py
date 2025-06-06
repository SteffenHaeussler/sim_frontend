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


async def listen_to_websocket(session_id, status_placeholder):
    ws_url = f"{WS_BASE}?session_id={session_id}"
    websocket = None
    try:
        async with websockets.connect(ws_url) as websocket:
            while True:
                msg = await websocket.recv()
                if msg.startswith("event:"):
                    # Handle status updates - update placeholder directly
                    status_text = msg.replace("event: ", "")
                    if status_text.strip():
                        status_placeholder.info(f"Status: {status_text.strip()}")
                        print(f"Status Update: {status_text.strip()}")
                        logger.info(f"Status Update: {status_text.strip()}")

                if msg.startswith("event: end"):
                    await websocket.close(code=1000, reason="Normal Closure")
                    break
                elif msg.startswith("data: "):
                    msg = msg.replace("data: ", "")
                    msg = msg.split("$%$%Plot:")

                    for m in msg[0].split("\n"):
                        st.markdown(f"{m}")

                    if len(msg) > 1:
                        base64_data = msg[1].strip()
                        base64_data = f"data:image/png;base64,{base64_data}"
                        st.image(base64_data)
                else:
                    pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
    finally:
        if websocket is not None:
            try:
                await websocket.close(code=1000, reason="Cleanup Closure")
            except Exception as close_error:
                logger.warning(f"Error during websocket close: {close_error}")


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
    st.title("API-based Agent")

    # Initialize session state
    if "session_id" not in st.session_state:
        st.session_state.session_id = uuid.uuid4()
    if "latest_status" not in st.session_state:
        st.session_state.latest_status = "Ready"

    st.write(f"Session ID: `{st.session_state.session_id}`")

    # Create status placeholder
    status_placeholder = st.empty()
    status_placeholder.info(f"Status: {st.session_state.latest_status}")

    question = st.text_input("Enter your question:", "")
    if st.button("Answer question") and question:
        trigger_event(st.session_state.session_id, question)

        asyncio.run(
            listen_to_websocket(st.session_state.session_id, status_placeholder)
        )


if __name__ == "__main__":
    main()
