# Agent Mail Hooks Configuration for Antigravity

This document explains how to configure Antigravity hooks for automatic agent mail checking.

## Overview

Since Antigravity supports hooks but the configuration files are in `.gemini/antigravity/`, this guide shows how to manually configure them.

## Hook Configuration

Add this to your Antigravity `settings.json` or hook configuration:

```json
{
  "tools": {
    "enableHooks": true
  },
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "name": "check-mail-startup",
            "type": "mcp",
            "server": "agent-mail",
            "tool": "fetch_inbox",
            "params": {
              "projectSlug": "demo",
              "agentName": "CodeWizard",
              "limit": 5
            },
            "description": "Check agent mail at session start",
            "timeout": 5000
          }
        ]
      }
    ],
    "AfterTool": [
      {
        "matcher": "task_boundary",
        "hooks": [
          {
            "name": "check-mail-milestone",
            "type": "mcp",
            "server": "agent-mail",
            "tool": "fetch_inbox",
            "params": {
              "projectSlug": "demo",
              "agentName": "CodeWizard",
              "limit": 3
            },
            "description": "Check mail after task boundaries",
            "timeout": 5000,
            "condition": "task.mode === 'VERIFICATION'"
          }
        ]
      }
    ]
  }
}
```

## Hook Types

### 1. SessionStart Hook
- **Trigger**: When conversation begins
- **Action**: Check inbox for new messages
- **Limit**: 5 most recent messages

### 2. AfterTool Hook (task_boundary)
- **Trigger**: After completing a task boundary in VERIFICATION mode
- **Action**: Check inbox for updates
- **Limit**: 3 most recent messages
- **Condition**: Only when completing verification phase

## Manual Configuration Steps

1. **Locate Antigravity config**:
   - Windows: `C:\Users\<username>\.gemini\antigravity\settings.json`
   - Or check for `mcp_config.json` or similar

2. **Add hooks section**: Copy the JSON above into your config

3. **Restart Antigravity**: Hooks take effect on next session

## Alternative: GEMINI.md Protocol

If hooks don't work or you prefer manual control, use the protocol in `GEMINI.md`:
- Agent checks mail at session start
- Agent checks mail after major milestones
- Agent checks mail before landing the plane
- User can request mail check anytime

## Testing Hooks

To verify hooks are working:

1. Start a new session
2. Look for automatic mail check at startup
3. Complete a task with `task_boundary` 
4. Check if mail is fetched automatically

## Troubleshooting

**Hooks not firing:**
- Check `enableHooks: true` is set
- Verify MCP server name matches ("agent-mail")
- Check tool name is correct ("fetch_inbox")
- Ensure server is running

**Windows-specific issues:**
- Use forward slashes in paths
- Avoid PowerShell script hooks (use MCP directly)
- Check file permissions on config files

## Current Status

✅ MCP server running on port 3001
✅ Agent "CodeWizard" registered in demo project  
✅ Manual mail checking works via MCP tools
⏳ Automatic hooks pending user configuration

## Next Steps

1. User configures hooks in Antigravity settings
2. Test automatic mail checking
3. Adjust frequency/conditions as needed
