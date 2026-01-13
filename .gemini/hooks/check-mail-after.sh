#!/usr/bin/env bash
# Agent Mail Check Hook - After Task Boundary
# Checks mail after completing verification phases

# Read hook input from stdin
input=$(cat)

# Extract event type and tool name
event=$(echo "$input" | jq -r '.event')
tool_name=$(echo "$input" | jq -r '.tool_name // "unknown"')

# Log for debugging
echo "[$(date)] AfterTool hook: $tool_name" >> .gemini/hook-debug.log

# Only check mail after task_boundary tool in VERIFICATION mode
if [ "$tool_name" = "task_boundary" ]; then
  # Use the CLI bridge to check for new tasks/messages
  AGENT_NAME=${GEMINI_AGENT_NAME:-CodeWizard}
  output=$(npm run cli -s check -- --agent "$AGENT_NAME" --project demo)
  
  if [ -n "$output" ]; then
    echo "$output"
  else
    echo "{}"
  fi
else
  # Silent for other tools
  echo "{}"
fi

exit 0
