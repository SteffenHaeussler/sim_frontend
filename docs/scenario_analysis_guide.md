# Scenario Analysis User Guide

## Overview

The Scenario Analysis feature enables parallel querying of multiple AI agents to analyze industrial processes from different perspectives.

## How to Use

1. **Login Required**: Click the "Scenario Analysis" button (requires authentication)

2. **Enter Your Query**: Type a question about your industrial process, such as:

   - "What are the current tank levels?"
   - "Show temperature trends for the cooler"
   - "Analyze pressure in the distillation column"

3. **Parallel Analysis**: The system automatically:

   - Analyzes your query
   - Sends it to multiple specialized agents (SQL and Tool agents)
   - Returns results in real-time

4. **View Results**: Each agent's response appears as it completes, showing:
   - Data analysis from SQL agent
   - Visualizations from Tool agent
   - Combined insights

## Example Queries

- **Asset Status**: "What is the status of asset FT-101?"
- **Performance**: "Show production metrics for the last 24 hours"
- **Troubleshooting**: "Why is the temperature rising in tank T-205?"

## Tips

- Be specific with asset names and time ranges
- Use the retry button if an agent fails
- Results are cached for 5 minutes for faster repeated queries
