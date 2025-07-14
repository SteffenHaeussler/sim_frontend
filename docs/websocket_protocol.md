# WebSocket Protocol Documentation

## Health WebSocket (`/ws/health`)

**Purpose**: Continuous health monitoring of the API

**Connection**: `ws://localhost:5062/ws/health`

**Messages**:

```json
// Server → Client (every 10 seconds)
{
  "version": "0.1.0",
  "timestamp": 1234567890.123
}
```

**Usage**: Connect to monitor API health status continuously.

## Scenario WebSocket (`/ws/scenario`)

**Purpose**: Real-time scenario analysis with parallel agent queries

**Connection**: `ws://localhost:5062/ws/scenario?session_id={uuid}&token={jwt_token}`

**Authentication**: Requires valid JWT token in query parameter

**Client → Server Messages**:

```json
// Query message
{
  "type": "query",
  "query": "What is the temperature?",
  "message_id": "msg-123"
}

// Retry message
{
  "type": "retry",
  "message_id": "msg-123",
  "sub_id": "rec-1",
  "agent_type": "sqlagent"
}
```

**Server → Client Messages**:

```json
// Recommendation
{
  "type": "scenario_recommendation",
  "message_id": "msg-123",
  "recommendations": [
    {
      "sub_id": "rec-1",
      "question": "Current temperature reading",
      "endpoint": "sqlagent"
    }
  ]
}

// Result
{
  "type": "scenario_result",
  "message_id": "msg-123",
  "sub_id": "rec-1",
  "agent": "sqlagent",
  "content": "Temperature is 75°C",
  "is_complete": true
}

// Error
{
  "type": "error",
  "error": "Invalid message format",
  "message_id": "msg-123"
}
```

**Connection Flow**:

1. Client connects with session_id and auth token
2. Client sends query message
3. Server responds with recommendations
4. Server streams results as agents complete
5. Client can retry failed agents
