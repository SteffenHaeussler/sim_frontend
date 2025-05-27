import os

import httpx
import streamlit as st
from dotenv import load_dotenv

# Load .env file
load_dotenv()

API_URL = os.getenv("agent_api_base") + os.getenv("agent_api_url")


def get_answer_from_real_endpoint(user_query: str) -> str:
    """
    Calls a real external API endpoint.
    """
    headers = {
        "Content-Type": "application/json",
        # "Authorization": f"Bearer {API_KEY}" # Example for Bearer token auth
    }
    payload = {
        "question": user_query  # Adjust payload structure based on your API
    }
    try:
        response = httpx.get(API_URL, params=payload, headers=headers, timeout=60)
        response.raise_for_status()  # Raise an exception for HTTP errors (4xx or 5xx)

        # Adjust how you extract the answer based on your API's response structure
        # For example, if the API returns: {"answer": "The bot's response"}
        api_response_data = response.json()

        if "response" in api_response_data:
            return api_response_data["response"]
        else:
            st.error("API response format is unexpected. 'answer' field missing.")
            return "Error: Could not parse API response."

    except httpx.RequestError as e:
        st.error(f"API Request Error: {e}")
        return "Error: Could not connect to the answer endpoint."
    except Exception as e:
        st.error(f"An unexpected error occurred: {e}")
        return "Error: An unexpected error occurred while fetching the answer."


# --- Streamlit App ---

st.set_page_config(page_title="Chatbot Interface", layout="centered")
st.title("🤖 Simple Chatbot")
st.caption("This chatbot calls a (simulated) answer endpoint.")

# Initialize chat history in session state if it doesn't exist
if "messages" not in st.session_state:
    st.session_state.messages = [
        {"role": "assistant", "content": "Hi! Ask me anything."}
    ]

# Display chat messages from history on app rerun
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# Accept user input
if prompt := st.chat_input("What is your question?"):
    # Add user message to chat history
    st.session_state.messages.append({"role": "user", "content": prompt})
    # Display user message in chat message container
    with st.chat_message("user"):
        st.markdown(prompt)

    # Display assistant response in chat message container
    with st.chat_message("assistant"):
        message_placeholder = st.empty()  # For streaming-like effect or spinner
        with st.spinner("Thinking..."):
            # --- CHOOSE YOUR ENDPOINT ---
            # For simulated endpoint:
            raw_assistant_response = get_answer_from_real_endpoint(prompt)

            # --- FORMAT THE RESPONSE FOR MARKDOWN LINE BREAKS ---
            # Replace single newlines with '  \n' for Markdown line breaks
            # Also, strip leading/trailing whitespace from the raw response first
            # to handle cases like your example starting with '\n'
            formatted_assistant_response = raw_assistant_response.strip().replace(
                "\n", "  \n"
            )

            # If you preferred HTML <br> tags:
            # formatted_assistant_response = raw_assistant_response.strip().replace("\n", "<br>")
            # And then you might need unsafe_allow_html=True for more complex HTML,
            # though <br> usually works without it.
            # message_placeholder.markdown(formatted_assistant_response, unsafe_allow_html=True)

            message_placeholder.markdown(formatted_assistant_response)

    # Add assistant response to chat history
    st.session_state.messages.append(
        {"role": "assistant", "content": raw_assistant_response}
    )

# Optional: Add a clear chat button
if (
    len(st.session_state.messages) > 1
):  # Show clear button only if there's more than the initial message
    if st.button("Clear Chat History"):
        st.session_state.messages = [
            {"role": "assistant", "content": "Hi! Ask me anything."}
        ]
        st.rerun()  # Rerun the app to reflect the cleared history
