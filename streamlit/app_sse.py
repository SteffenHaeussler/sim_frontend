import asyncio
import os
import threading
import uuid

import httpx
from dotenv import load_dotenv
from loguru import logger

import streamlit as st

# Load .env file
load_dotenv()

API_BASE = os.getenv("AGENT_API_BASE")

API_URL = API_BASE + os.getenv("AGENT_API_URL")


async def listen_to_sse(session_id):
    sse_url = f"{API_BASE}/sse/{session_id}"
    timeout = httpx.Timeout(connect=10.0, read=180.0, write=10.0, pool=10.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client, client.stream("GET", sse_url) as response:
            async for message in response.aiter_lines():
                if message.startswith(": keep-alive"):
                    continue

                if message.startswith("event: end"):
                    return  # End the SSE connection

                # Check if message contains base64 image
                if message.startswith("data: "):
                    message = message.replace("data: ", "")
                else:
                    pass

                for _message in message.split("$%$%"):
                    if _message.startswith("Plot:"):
                        try:
                            # Extract the base64 part after the comma
                            base64_data = _message.split("Plot:")[1].strip()
                            # Add data URI prefix for PNG image
                            base64_data = f"data:image/png;base64,{base64_data}"
                            # Display the image using the data URI
                            st.image(base64_data)
                        except Exception as e:
                            logger.error(f"Error processing image: {e}")

                        else:
                            for m in _message.split("\n"):
                                st.markdown(f"{m}")

    except Exception as e:
        logger.error(f"SSE error: {e}", exc_info=True)


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

    st.session_state.session_id = uuid.uuid4()
    st.write(f"Session ID: `{st.session_state.session_id}`")

    question = st.text_input("Enter your question:", "")
    if st.button("Answer question") and question:
        trigger_event(st.session_state.session_id, question)

        asyncio.run(listen_to_sse(st.session_state.session_id))


if __name__ == "__main__":
    main()
