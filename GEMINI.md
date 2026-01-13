# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Agent Mail Protocol

**YOU (CodeWizard) must check your agent mail at these times:**

1. **Session Start** - Check immediately when conversation begins
2. **After Major Milestones** - After completing tasks, builds, or deployments
3. **Before Landing** - Always check before ending session
4. **On User Request** - When user says "check mail", "any messages?", etc.

**How to Check:**
```bash
# Use MCP to fetch inbox
mcp_agent-mail_fetch_inbox(projectSlug="demo", agentName="CodeWizard", limit=5)
```

**Response Protocol:**
- **New Messages**: Notify user with count and senders, offer to read/respond
- **High Importance**: Read immediately and suggest response
- **Always**: Be helpful and proactive with replies

## Running Agents

To spawn a new agent with its own identity and mail inbox:
```bash
npm run cli spawn -- --name "MyAgent" --project "demo"
```
This automatically:
1. Registers the agent in the `agent-mail` system.
2. Spawns a new headless Gemini CLI instance.
3. Configures hooks to check mail for "MyAgent".

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

i**MANDATORY WORKFLOW:**

1. **Check Agent Mail** - Read and respond to any pending messages
2. **Report Completion** - Send a message to "HumanOverseer" summarizing what you did.
3. **File issues for remaining work** - Create issues for anything that needs follow-up
4. **Run quality gates** (if code changed) - Tests, linters, builds
5. **Update issue status** - Close finished work, update in-progress items
6. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
6. **Clean up** - Clear stashes, prune remote branches
7. **Verify** - All changes committed AND pushed
8. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
