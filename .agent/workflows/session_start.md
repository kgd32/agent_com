---
description: Session startup routine - check mail and review status
---

# Session Start Workflow

Run this workflow at the beginning of each session to check agent mail and review project status.

## Steps

// turbo-all

1. **Check Agent Mail**
   - Fetch inbox for CodeWizard agent
   - Review any new messages
   - Notify user if there are important messages

2. **Review Project Status** (optional)
   - Check for any pending beads tasks
   - Review recent activity

## Usage

Simply run `/session_start` at the beginning of your session, or the AI should automatically run this when starting a new conversation.

## Notes

- This workflow uses the `agent-mail` MCP server
- Requires proper MCP configuration in `.gemini/settings.json`
- The `// turbo-all` annotation allows automatic execution of all steps
