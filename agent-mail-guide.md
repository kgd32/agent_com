# Agent-to-Agent Communication System - Implementation Guide

## Executive Summary

Build a barebones agent coordination system inspired by MCP Agent Mail, using Node.js/TypeScript with SQLite storage. Focus on developer experience and human-in-the-loop workflows.

**Core Philosophy:**
- **Simple beats complex** - SQLite over Postgres, filesystem over S3
- **Human oversight first** - Every critical flow should be reviewable
- **Agent-friendly** - APIs should feel natural to LLMs
- **Audit by default** - Every message, every decision, logged

---

## Architecture Overview

```
┌─────────────┐
│   Agent A   │
│ (Claude/GPT)│
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│   MCP Server (Node.js/TS)       │
│                                 │
│  ┌─────────────────────────┐   │
│  │  Message Queue          │   │
│  │  - inbox/outbox         │   │
│  │  - thread management    │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │  Human Overseer         │   │
│  │  - approval workflows   │   │
│  │  - broadcast messages   │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │  Beads Integration      │   │
│  │  - task tracking        │   │
│  │  - progress updates     │   │
│  └─────────────────────────┘   │
└─────────────┬───────────────────┘
              │
              ▼
       ┌──────────────┐
       │   SQLite     │
       │  (messages,  │
       │   agents,    │
       │   threads)   │
       └──────────────┘
```

---

## File Structure

```
agent-mail/
├── src/
│   ├── server/
│   │   ├── index.ts              # MCP server entry
│   │   ├── tools.ts              # MCP tool definitions
│   │   └── resources.ts          # MCP resource definitions
│   │
│   ├── core/
│   │   ├── database.ts           # SQLite setup
│   │   ├── schema.ts             # Database schema
│   │   ├── agents.ts             # Agent management
│   │   ├── messages.ts           # Message handling
│   │   ├── threads.ts            # Thread management
│   │   └── contacts.ts           # Contact policy enforcement
│   │
│   ├── human/
│   │   ├── overseer.ts           # Human message interface
│   │   ├── approvals.ts          # Approval workflow
│   │   └── dashboard.ts          # Status/metrics endpoint
│   │
│   ├── integrations/
│   │   └── beads.ts              # Beads task integration
│   │
│   └── utils/
│       ├── logger.ts             # Structured logging
│       ├── names.ts              # Agent name generator
│       └── validation.ts         # Input validation
│
├── db/
│   └── migrations/               # SQLite migrations
│
├── tests/
│   ├── agents.test.ts
│   ├── messages.test.ts
│   └── integration.test.ts
│
├── package.json
├── tsconfig.json
└── README.md
```

---

## Database Schema (SQLite)

### Core Tables

```sql
-- Projects (workspace isolation)
CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  human_name TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Agents (identities)
CREATE TABLE agents (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,              -- "GreenMountain"
  program TEXT,                     -- "claude-code"
  model TEXT,                       -- "claude-sonnet-4.5"
  contact_policy TEXT DEFAULT 'auto', -- 'open', 'auto', 'contacts_only'
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  last_active_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  UNIQUE(project_id, name)
);

-- Messages
CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  thread_id TEXT,                   -- "bd-123" or generated
  from_agent_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,               -- Markdown
  importance TEXT DEFAULT 'normal', -- 'low', 'normal', 'high'
  ack_required INTEGER DEFAULT 0,   -- Boolean
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (from_agent_id) REFERENCES agents(id)
);

-- Message Recipients
CREATE TABLE message_recipients (
  id INTEGER PRIMARY KEY,
  message_id INTEGER NOT NULL,
  agent_id INTEGER NOT NULL,
  kind TEXT NOT NULL,               -- 'to', 'cc', 'bcc'
  read_at INTEGER,
  ack_at INTEGER,
  FOREIGN KEY (message_id) REFERENCES messages(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- Contact Links (consent layer)
CREATE TABLE agent_links (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  from_agent_id INTEGER NOT NULL,
  to_agent_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',    -- 'pending', 'approved', 'denied'
  reason TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  expires_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (from_agent_id) REFERENCES agents(id),
  FOREIGN KEY (to_agent_id) REFERENCES agents(id),
  UNIQUE(project_id, from_agent_id, to_agent_id)
);

-- Human Approvals (HITL workflows)
CREATE TABLE human_approvals (
  id INTEGER PRIMARY KEY,
  entity_type TEXT NOT NULL,        -- 'message', 'contact', 'task'
  entity_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',    -- 'pending', 'approved', 'rejected'
  requested_at INTEGER DEFAULT (strftime('%s', 'now')),
  resolved_at INTEGER,
  human_note TEXT
);

-- Beads Integration (optional)
CREATE TABLE beads_tasks (
  id INTEGER PRIMARY KEY,
  task_id TEXT UNIQUE NOT NULL,     -- "bd-123"
  thread_id TEXT,                   -- Link to message thread
  status TEXT,                      -- Synced from Beads
  assigned_agent_id INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER,
  FOREIGN KEY (assigned_agent_id) REFERENCES agents(id)
);

-- Indexes for performance
CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_messages_project ON messages(project_id);
CREATE INDEX idx_recipients_agent ON message_recipients(agent_id);
CREATE INDEX idx_agents_project ON agents(project_id);
```

---

## MCP Server Implementation

### Tool Catalog

**Identity & Discovery:**
- `register_agent` - Create/update agent identity
- `whois` - Look up agent details
- `list_agents` - Browse active agents

**Messaging:**
- `send_message` - Send a message (with contact check)
- `fetch_inbox` - Get unread/recent messages
- `reply_message` - Reply to a message (preserves thread)
- `acknowledge_message` - Mark message as acknowledged

**Contact Management:**
- `request_contact` - Request permission to message
- `respond_contact` - Approve/deny contact request
- `list_contacts` - View approved contacts

**Human Oversight:**
- `send_human_message` - Human broadcasts to agents
- `request_human_approval` - Agent requests human decision
- `list_pending_approvals` - Human reviews queue

**Beads Integration:**
- `link_task_to_thread` - Connect Beads task to conversation
- `update_task_status` - Sync status from agent to Beads

### Resource Catalog

**Read-only data access:**
- `resource://inbox/{agent}?project={slug}&limit=20`
- `resource://thread/{thread_id}?project={slug}`
- `resource://agents?project={slug}`
- `resource://approvals?status=pending`

---

## Implementation Details

### 1. Database Module (`core/database.ts`)

```typescript
import Database from 'better-sqlite3';

interface DatabaseConfig {
  path: string;
  verbose?: boolean;
}

export class AgentMailDB {
  private db: Database.Database;

  constructor(config: DatabaseConfig) {
    this.db = new Database(config.path, { 
      verbose: config.verbose ? console.log : undefined 
    });
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  // Helper methods for transactions, queries
  // Use prepared statements for all operations
}
```

**Key decisions:**
- Use `better-sqlite3` (synchronous, simple)
- WAL mode for concurrent reads
- Prepared statements to prevent SQL injection
- Simple transaction helpers

### 2. Agent Management (`core/agents.ts`)

```typescript
export interface Agent {
  id: number;
  projectId: number;
  name: string;          // "GreenMountain"
  program: string;       // "claude-code"
  model: string;         // "claude-sonnet-4.5"
  contactPolicy: 'open' | 'auto' | 'contacts_only';
  createdAt: number;
  lastActiveAt?: number;
}

export class AgentManager {
  constructor(private db: AgentMailDB) {}

  // Generate memorable names: adjective + noun
  // "GreenMountain", "BlueLake", "RedForest"
  generateName(): string {
    // Implementation uses random selection from curated lists
  }

  register(params: RegisterAgentParams): Agent {
    // 1. Generate name if not provided
    // 2. Check uniqueness within project
    // 3. Insert or update agent record
    // 4. Update last_active_at
    // 5. Return agent object
  }

  updateActivity(agentId: number): void {
    // Touch last_active_at timestamp
  }

  whois(projectId: number, name: string): Agent | null {
    // Look up agent by name in project
  }

  list(projectId: number, options?: ListOptions): Agent[] {
    // List agents with optional filters:
    // - recentlyActive (last 24h)
    // - contactPolicy
  }
}
```

**Key decisions:**
- Memorable names help humans track agents
- Names are unique per project
- Activity tracking for stale detection
- Simple policy enforcement

### 3. Message Handling (`core/messages.ts`)

```typescript
export interface Message {
  id: number;
  projectId: number;
  threadId: string;
  fromAgentId: number;
  subject: string;
  body: string;          // Markdown
  importance: 'low' | 'normal' | 'high';
  ackRequired: boolean;
  createdAt: number;
}

export class MessageManager {
  constructor(
    private db: AgentMailDB,
    private contactManager: ContactManager
  ) {}

  async send(params: SendMessageParams): Promise<Message> {
    // 1. Validate sender exists
    // 2. Check contact policy for each recipient
    //    - If blocked, try auto-handshake or return error
    // 3. Generate thread_id if not provided
    // 4. Insert message record
    // 5. Insert recipient records (to, cc, bcc)
    // 6. Update sender's last_active_at
    // 7. Return message object
  }

  fetchInbox(
    agentId: number, 
    options?: InboxOptions
  ): Message[] {
    // Query messages where agent is recipient
    // Options: since, limit, urgentOnly, includeBody
    // Join with message_recipients for read/ack status
  }

  reply(params: ReplyParams): Promise<Message> {
    // 1. Fetch original message
    // 2. Extract thread_id (or generate from original id)
    // 3. Prefix subject with "Re: "
    // 4. Send new message in same thread
  }

  acknowledge(agentId: number, messageId: number): void {
    // Update message_recipients.ack_at timestamp
  }
}
```

**Key decisions:**
- Contact policy checked on every send
- Thread IDs can be user-provided (e.g., "bd-123") or auto-generated
- Inbox queries are agent-centric
- Markdown bodies for rich formatting

### 4. Contact Policy (`core/contacts.ts`)

```typescript
export class ContactManager {
  constructor(private db: AgentMailDB) {}

  canMessage(
    fromAgentId: number,
    toAgentId: number,
    context?: MessageContext
  ): boolean {
    // 1. Get recipient's contact policy
    // 2. If 'open': return true
    // 3. If 'contacts_only': check for approved link
    // 4. If 'auto': check heuristics
    //    - Same thread participants
    //    - Recent shared context
    //    - Approved link
    // 5. Return boolean
  }

  requestContact(params: RequestContactParams): void {
    // 1. Insert agent_link record (status: 'pending')
    // 2. Send intro message to recipient (ack_required)
    // 3. Create human approval record if configured
  }

  respondContact(params: RespondContactParams): void {
    // 1. Update agent_link status ('approved' or 'denied')
    // 2. Set expires_at if approved (default 7 days)
    // 3. Send confirmation message
  }

  listContacts(agentId: number): AgentLink[] {
    // Return approved links for agent
  }
}
```

**Key decisions:**
- "Open" policy for trusted teams
- "Auto" policy for smart defaults (reduces friction)
- "Contacts only" for strict control
- Expiring approvals force revalidation

### 5. Human Overseer (`human/overseer.ts`)

```typescript
export class HumanOverseer {
  constructor(
    private db: AgentMailDB,
    private messageManager: MessageManager
  ) {}

  // Human sends high-priority message to agents
  broadcast(params: BroadcastParams): Message {
    // 1. Create special agent "HumanOverseer"
    // 2. Compose message with standard preamble:
    //    "🚨 MESSAGE FROM HUMAN OVERSEER 🚨"
    //    "Pause current work, prioritize this request"
    // 3. Set importance: 'high', ack_required: true
    // 4. Send to specified agents (bypass contact policy)
  }

  // Human approves/rejects requests
  resolveApproval(approvalId: number, decision: Decision): void {
    // 1. Update human_approvals record
    // 2. Execute approved action (e.g., send message, approve contact)
    // 3. Notify requesting agent
  }

  // Human views pending items
  listPendingApprovals(): Approval[] {
    // Return human_approvals where status = 'pending'
  }

  // Human views dashboard metrics
  getDashboard(projectId: number): Dashboard {
    // Aggregate stats:
    // - Active agents count
    // - Messages sent/received today
    // - Pending approvals count
    // - Overdue acknowledgments
    // - Recent activity timeline
  }
}
```

**Key decisions:**
- Humans bypass all policy checks
- Clear "overseer" identity for transparency
- Approval workflow for sensitive operations
- Dashboard for situational awareness

### 6. Beads Integration (`integrations/beads.ts`)

```typescript
export class BeadsIntegration {
  constructor(
    private db: AgentMailDB,
    private beadsClient: BeadsClient  // Shell out to `bd` CLI
  ) {}

  linkTaskToThread(taskId: string, threadId: string): void {
    // 1. Verify task exists in Beads
    // 2. Insert/update beads_tasks record
    // 3. Link thread_id
  }

  updateTaskStatus(taskId: string, status: string, note: string): void {
    // 1. Update local beads_tasks cache
    // 2. Shell out: `bd update ${taskId} --status ${status} --note "${note}"`
    // 3. Send message in linked thread announcing update
  }

  syncFromBeads(): void {
    // 1. Shell out: `bd list --json`
    // 2. Update beads_tasks table with latest status
    // 3. Notify agents if their assigned tasks changed
  }

  // Helper: Agent picks ready work
  getReadyTasks(agentId: number): BeadsTask[] {
    // 1. Shell out: `bd ready --json`
    // 2. Filter for tasks assigned to agent (if any)
    // 3. Return sorted by priority
  }
}
```

**Key decisions:**
- Beads is source of truth for task state
- Agent Mail handles communication & context
- Use task ID (e.g., "bd-123") as thread ID
- Sync periodically or on-demand

---

## Developer Experience Priorities

### Setup Experience

**Goal: Zero to running in < 2 minutes**

```bash
# 1. Clone and install
git clone <repo>
cd agent-mail
npm install

# 2. Initialize database
npm run db:init

# 3. Start server
npm run dev

# ✅ Server running on port 8765
# ✅ Database created at ./data/agent-mail.db
# ✅ MCP server ready for connections
```

**Key decisions:**
- SQLite requires zero external setup
- Auto-create database on first run
- Clear error messages for missing dependencies
- Example config file with comments

### Agent Experience

**Goal: LLMs can use this without confusion**

```typescript
// Tool descriptions should be LLM-friendly:

{
  name: "send_message",
  description: `
    Send a message to one or more agents.
    
    Required fields:
    - projectSlug: Your workspace (e.g., "backend-abc123")
    - from: Your agent name (e.g., "GreenMountain")
    - to: List of recipient names (e.g., ["BlueLake", "RedForest"])
    - subject: Brief topic (e.g., "API schema review")
    - body: Markdown message content
    
    Optional fields:
    - threadId: Continue existing conversation (e.g., "bd-123")
    - importance: "low", "normal", or "high"
    - ackRequired: Request explicit acknowledgment
    
    Contact policy: If recipient has 'contacts_only' policy and you're
    not approved, this will fail with CONTACT_REQUIRED. Call 
    'request_contact' first, then retry after approval.
  `,
  inputSchema: { /* JSON Schema */ }
}
```

**Key decisions:**
- Natural language descriptions
- Common error scenarios explained upfront
- Concrete examples in every tool
- Consistent naming patterns

### Human Experience

**Goal: Humans understand what agents are doing**

**Dashboard view:**
```
┌─────────────────────────────────────────────────────┐
│ Agent Mail Dashboard - Project: backend-abc123      │
├─────────────────────────────────────────────────────┤
│ Active Agents: 3                                    │
│   • GreenMountain (claude-code) - 2m ago            │
│   • BlueLake (cursor) - 5m ago                      │
│   • RedForest (cline) - 15m ago                     │
│                                                     │
│ Recent Activity:                                    │
│   [14:23] GreenMountain → BlueLake: "Schema review"│
│   [14:20] BlueLake → all: "Starting API tests"     │
│   [14:15] HumanOverseer → all: "Pause for hotfix"  │
│                                                     │
│ Pending Approvals: 1                                │
│   • BlueLake requesting contact with RedForest      │
│     Reason: "Need to coordinate auth changes"       │
│     [Approve] [Deny]                                │
│                                                     │
│ Thread Activity:                                    │
│   • bd-123: 5 messages (last: 2m ago)              │
│   • bd-124: 2 messages (last: 30m ago)             │
└─────────────────────────────────────────────────────┘
```

**Key decisions:**
- Relative timestamps ("2m ago")
- Color-coded importance levels
- One-click approvals
- Activity feed with context

---

## Implementation Phases

### Phase 1: Core Messaging (Week 1)
**Goal: Agents can send/receive messages**

- [ ] Database schema + migrations
- [ ] Agent registration
- [ ] Send message (bypass policy)
- [ ] Fetch inbox
- [ ] Reply to message
- [ ] MCP server scaffolding
- [ ] Basic tests

**Validation:** Two agents can have a conversation

### Phase 2: Contact Policy (Week 2)
**Goal: Agents respect consent**

- [ ] Contact policy enforcement
- [ ] Request/respond contact
- [ ] Auto-approval heuristics
- [ ] Policy bypass for replies
- [ ] Tests for all policies

**Validation:** Agent can't spam another agent

### Phase 3: Human Oversight (Week 3)
**Goal: Humans can intervene**

- [ ] Human message broadcast
- [ ] Approval workflow
- [ ] Dashboard metrics endpoint
- [ ] Simple web UI (optional)

**Validation:** Human can stop agents and redirect

### Phase 4: Beads Integration (Week 4)
**Goal: Task-driven coordination**

- [ ] Task-thread linking
- [ ] Status updates flow both ways
- [ ] Ready work queries
- [ ] Notification on task changes

**Validation:** Agent picks Beads task, works, updates status

### Phase 5: Polish (Week 5+)
**Goal: Production-ready**

- [ ] Error recovery
- [ ] Rate limiting
- [ ] Logging/observability
- [ ] Performance optimization
- [ ] Documentation
- [ ] Example workflows

---

## Configuration

### Minimal `.env` file:

```bash
# Database
DATABASE_PATH=./data/agent-mail.db

# MCP Server
MCP_PORT=8765
MCP_HOST=127.0.0.1

# Policies
DEFAULT_CONTACT_POLICY=auto
CONTACT_AUTO_APPROVE=true      # Auto-approve 'auto' policy requests
CONTACT_EXPIRE_DAYS=7          # Links expire after 7 days

# Human Oversight
REQUIRE_HUMAN_APPROVAL=false   # Enable for sensitive operations
HUMAN_APPROVAL_TIMEOUT_HOURS=24

# Beads Integration
BEADS_CLI_PATH=bd              # Path to 'bd' command
BEADS_SYNC_INTERVAL_MINUTES=5  # How often to sync task status

# Logging
LOG_LEVEL=info
LOG_FORMAT=json                # 'json' or 'pretty'
```

---

## Testing Strategy

### Unit Tests
- Agent registration (name generation, uniqueness)
- Message sending (validation, recipient lookup)
- Contact policy (all scenarios)
- Beads integration (task linking, status sync)

### Integration Tests
- Full message flow (send → inbox → reply)
- Contact request → approval → message
- Human broadcast → agent acknowledgment
- Beads task → thread → status update

### E2E Scenarios
```typescript
describe('Agent Coordination', () => {
  it('agents coordinate on a Beads task', async () => {
    // 1. Agent A picks task bd-123
    // 2. Agent A sends message to Agent B in thread bd-123
    // 3. Agent B replies in same thread
    // 4. Agent A completes work, updates Beads
    // 5. Verify thread linked to task
    // 6. Verify status synced
  });

  it('human intervention redirects agents', async () => {
    // 1. Agent A working on feature
    // 2. Human broadcasts "STOP, hotfix needed"
    // 3. Agent A acknowledges
    // 4. Agent A switches to hotfix thread
    // 5. Verify original thread paused
  });
});
```

---

## Common Pitfalls & Solutions

### Pitfall 1: Thread ID Confusion
**Problem:** Agents lose context by creating new threads

**Solution:**
- Always pass `threadId` when replying
- Generate from Beads task ID when available
- Include in message subject for visibility

### Pitfall 2: Contact Policy Too Strict
**Problem:** Agents blocked from collaborating

**Solution:**
- Default to 'auto' policy
- Auto-approve same-thread participants
- Clear error messages explain how to request contact

### Pitfall 3: Human Approval Bottleneck
**Problem:** Agents stalled waiting for approval

**Solution:**
- Make approvals optional (config flag)
- Time out approvals after 24h (proceed with warning)
- Dashboard shows pending queue prominently

### Pitfall 4: Database Lock Contention
**Problem:** SQLite locks under concurrent load

**Solution:**
- Use WAL mode (allows concurrent reads)
- Keep transactions short
- Add retry logic with exponential backoff

### Pitfall 5: Lost Messages
**Problem:** No delivery confirmation

**Solution:**
- Return message ID on send
- Provide "message delivered" resource
- Log all send attempts

---

## Observability

### Metrics to Track
- Messages sent/received per agent
- Average thread length
- Contact request approval rate
- Human intervention frequency
- Beads task completion time

### Logs to Emit
```typescript
// Structured logging example:
logger.info('message_sent', {
  messageId: 123,
  fromAgent: 'GreenMountain',
  toAgents: ['BlueLake'],
  threadId: 'bd-123',
  importance: 'high',
  ackRequired: true
});

logger.warn('contact_blocked', {
  fromAgent: 'RedForest',
  toAgent: 'BlueLake',
  policy: 'contacts_only',
  action: 'request_sent'
});
```

### Health Checks
- Database connectivity
- Recent message activity
- Stuck threads (no activity > 1 hour)
- Overdue acknowledgments

---

## Next Steps for Implementation

### With Claude Code or Antigravity:

1. **Start with schema:**
   - Paste database schema above
   - Ask: "Create SQLite migration files for this schema"

2. **Implement database layer:**
   - Paste `database.ts` outline
   - Ask: "Implement AgentMailDB class with better-sqlite3"

3. **Build core managers one by one:**
   - AgentManager → MessageManager → ContactManager
   - For each: paste the interface/outline, ask for implementation

4. **Add MCP server:**
   - Ask: "Create MCP server with these tools: [list]"
   - Provide tool signatures and expected behavior

5. **Integrate Beads:**
   - Ask: "Implement BeadsIntegration using child_process to shell out to 'bd' CLI"

6. **Add human oversight:**
   - Ask: "Implement HumanOverseer with broadcast and approval methods"

7. **Write tests:**
   - Ask: "Create unit tests for AgentManager" (etc.)

8. **Build simple dashboard:**
   - Optional: Ask for Express server with dashboard endpoint

### Key Prompts for Assistant:

**"Follow the interfaces exactly as defined in this guide. Use prepared statements for all SQL. Add comprehensive error handling. Include TypeScript types for all parameters."**

**"Keep it simple - no fancy abstractions. A human should be able to read the code and understand the flow immediately."**

**"Add detailed JSDoc comments explaining the business logic, especially for contact policy and approval workflows."**

---

## Resources

- **SQLite:** https://www.sqlite.org/wal.html
- **better-sqlite3:** https://github.com/WiseLibs/better-sqlite3
- **MCP Specification:** https://spec.modelcontextprotocol.io/
- **Beads:** https://github.com/steveyegge/beads

---

## Final Notes

This guide intentionally omits:
- Authentication (add JWT if exposing over network)
- File attachments (adds complexity, start without)
- Search (SQLite FTS5, add later if needed)
- Web UI (CLI + dashboard API is sufficient initially)

Focus on **agent-to-agent messaging with human oversight**. Everything else is optional.