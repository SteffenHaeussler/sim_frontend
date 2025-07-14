export class ScenarioMessageGrouper {
  constructor() {
    this.messages = new Map();
  }

  addRecommendationMessage(message) {
    if (message.type !== "scenario_recommendation") {
      throw new Error("Invalid message type for recommendation");
    }

    this.messages.set(message.message_id, {
      type: "scenario",
      messageId: message.message_id,
      sessionId: message.session_id,
      query: message.query,
      recommendations: message.recommendations,
      results: new Map(),
    });
  }

  addResultMessage(message) {
    if (message.type !== "scenario_result") {
      throw new Error("Invalid message type for result");
    }

    const parentMessage = this.messages.get(message.message_id);
    if (!parentMessage) {
      throw new Error(`Parent message ${message.message_id} not found`);
    }

    parentMessage.results.set(message.sub_id, {
      subId: message.sub_id,
      agent: message.agent,
      content: message.content,
      isComplete: message.is_complete,
      error: message.error || null,
    });
  }

  getGroupedMessage(messageId) {
    return this.messages.get(messageId);
  }

  getCompletionStatus(messageId) {
    const message = this.messages.get(messageId);
    if (!message) return null;

    const totalExpected = message.recommendations.length;
    const completed = Array.from(message.results.values()).filter(
      (r) => r.isComplete,
    ).length;

    return {
      total: totalExpected,
      completed: completed,
      percentage: Math.round((completed / totalExpected) * 100),
    };
  }
}
