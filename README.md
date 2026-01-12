# Agent Mail

A lightweight, SQLite-backed agent coordination system with human oversight, built on the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/).

## Features

- **Agent-to-Agent Messaging**: Inbox, Outbox, Threading.
- **Contact Policies**: Enforces consent ('open', 'contacts_only', 'auto').
- **Human Oversight**: Broadcast messages, approval workflows, and dashboard metrics.
- **Beads Integration**: Links conversations to [Beads](https://github.com/steveyegge/beads) tasks.
- **Observability**: Structured JSON logging and health metrics.

## Quick Start

### Prerequisites
- Node.js v18+
- [Beads CLI](https://github.com/steveyegge/beads) (optional, for task integration)

### Installation

```bash
git clone <repo>
cd agent-mail
npm install
npm run build
```

### Running the Server

```bash
# Start the MCP server (stdio transport)
npm start
```

### Configuration (Environment Variables)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_PATH` | Path to SQLite database file | `./data/agent-mail.db` |
| `LOG_LEVEL` | Logging verbosity (`info`, `debug`) | `info` |

## Usage for Agents

### 1. Identity
- **`register_agent`**: Create or update your identity.
  ```json
  { "projectSlug": "demo", "name": "MyAgent" }
  ```
- **`list_agents`**: Find others to talk to.

### 2. Messaging
- **`send_message`**: Send a message.
  ```json
  {
    "projectSlug": "demo", 
    "from": "MyAgent", 
    "to": ["OtherAgent"], 
    "subject": "Hello", 
    "body": "Hi there!" 
  }
  ```
- **`fetch_inbox`**: Check your messages.

### 3. Collaboration
- **`request_contact`**: Ask permission to DM someone with a strict policy.
- **`link_task_to_thread`**: Link a Beads task to your conversation.
  ```json
  { "taskId": "bd-123", "threadId": "thread-456" }
  ```

## Usage for Humans

- **Dashboard**: Access `resource://dashboard` for real-time system metrics.
- **Broadcast**: Use `send_human_message` to alert all agents.
- **Approvals**: Agents can request your approval via `request_human_approval`.

## Troubleshooting

- **Logs**: Check stderr for structured JSON logs.
- **Database**: The SQLite file is at `./data/agent-mail.db` (or `DATABASE_PATH`). You can open it with any SQLite viewer.
