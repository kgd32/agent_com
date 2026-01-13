# Remote MCP Configuration Guide

## Overview

The agent-mail MCP server now supports **remote connections** via HTTP/SSE transport, allowing multiple clients (web interface, CLI, spawned agents) to connect to a single shared server instance.

## Server Configuration

### Starting the Server

The server now runs as a **dual-port system** for maximum compatibility:
- **Port 3001**: REST API + Shared Database (Strict)
- **Port 3002**: Dedicated MCP Server (Loose CORS + Wildcard catch-all)

### Starting the Server

**Remote-only mode** (SSE only, no stdio):
```bash
MCP_TRANSPORT=remote-only npm start
```

**Hybrid mode** (both SSE and stdio):
```bash
npm start
```

The server will expose:
- **API**: `http://localhost:3001/api`
- **MCP Endpoint**: `http://localhost:3002/` (Catch-all)

## Client Configuration

### For Gemini CLI

Update your MCP configuration file (`.gemini/settings.json` or global `mcp_config.json`):

**Before (stdio):**
```json
{
  "mcpServers": {
    "agent-mail": {
      "command": "node",
      "args": ["c:/Users/Kimpa/Documents/Vibe/agent_com/dist/server/index.js"],
      "env": { "DATABASE_PATH": "..." }
    }
  }
}
```

**Remote Streamable HTTP (Recommended):**
```json
{
  "mcpServers": {
    "agent-mail": {
      "url": "http://localhost:3002/",
      "httpUrl": "http://localhost:3002/",
      "transport": "sse"
    }
  }
}
```

### For Web Interface

The web interface connects to the remote MCP server automatically when configured in the global MCP settings.
Use `http://localhost:3002/` as the URL.

## Benefits

✅ **Single Server Instance** - All clients connect to one server  
✅ **Shared Database** - Consistent state across all connections  
✅ **No Process Spawning** - Lightweight client connections  
✅ **Multi-Agent Support** - Multiple AI agents can connect simultaneously

## Testing

1. **Start the server in remote mode**:
   ```bash
   MCP_TRANSPORT=remote-only npm start
   ```

2. **Verify endpoints are available**:
   ```bash
   curl http://localhost:3001/mcp/sse
   # Should establish SSE connection
   ```

3. **Update MCP config** to use remote URL

4. **Restart Gemini CLI** and test MCP tools:
   ```bash
   mcp_agent-mail_fetch_inbox(projectSlug="demo", agentName="CodeWizard")
   ```

### Concurrent Clients
The server now supports **multiple concurrent client sessions**. Each client (CLI, Web, Worker) that connects to `http://localhost:3002/` is assigned a unique `mcp-session-id`. This ensures that:
- Multiple Gemini CLI instances can run simultaneously.
- The Web UI can remain connected while background agents are spawning.
- Each session has its own isolated initialization state.

## Troubleshooting

**Connection refused**: Ensure server is running with `npm start`  
**Session not found**: If you see "Session not found", ensure your client supports the **Streamable HTTP** handshake (initializing before sending messages). This is handled automatically by the modern Gemini CLI and the MCP SDK's `StreamableHttpClient`.
**CORS errors**: Server allows localhost by default, check origin headers
