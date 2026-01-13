#!/usr/bin/env bash
# Agent Mail Check Hook - Session Start
# Checks CodeWizard's inbox when a new session begins

# Log for debugging
echo "[$(date)] SessionStart hook triggered" >> .gemini/hook-debug.log

# Call our new CLI to check for mail/tasks
# We use -s to suppress npm noise, but let stderr show failures
AGENT_NAME=${GEMINI_AGENT_NAME:-CodeWizard}
output=$(npm run cli -s check -- --agent "$AGENT_NAME" --project demo)

if [ -n "$output" ]; then
    echo "$output"
else
    # Fallback to a silent message or just exit
    exit 0
fi
