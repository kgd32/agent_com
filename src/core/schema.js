"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCHEMA = void 0;
exports.SCHEMA = ;
`
-- Projects (workspace isolation)
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  human_name TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Agents (identities)
CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  program TEXT,
  model TEXT,
  contact_policy TEXT DEFAULT 'auto', -- 'open', 'auto', 'contacts_only'
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  last_active_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  UNIQUE(project_id, name)
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  thread_id TEXT,
  from_agent_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  importance TEXT DEFAULT 'normal', -- 'low', 'normal', 'high'
  ack_required INTEGER DEFAULT 0,   -- Boolean
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (from_agent_id) REFERENCES agents(id)
);

-- Message Recipients
CREATE TABLE IF NOT EXISTS message_recipients (
  id INTEGER PRIMARY KEY,
  message_id INTEGER NOT NULL,
  agent_id INTEGER NOT NULL,
  kind TEXT NOT NULL, -- 'to', 'cc', 'bcc'
  read_at INTEGER,
  ack_at INTEGER,
  FOREIGN KEY (message_id) REFERENCES messages(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- Contact Links (consent layer)
CREATE TABLE IF NOT EXISTS agent_links (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  from_agent_id INTEGER NOT NULL,
  to_agent_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'denied'
  reason TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  expires_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (from_agent_id) REFERENCES agents(id),
  FOREIGN KEY (to_agent_id) REFERENCES agents(id),
  UNIQUE(project_id, from_agent_id, to_agent_id)
);

-- Human Approvals (HITL workflows)
CREATE TABLE IF NOT EXISTS human_approvals (
  id INTEGER PRIMARY KEY,
  entity_type TEXT NOT NULL, -- 'message', 'contact', 'task'
  entity_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  requested_at INTEGER DEFAULT (strftime('%s', 'now')),
  resolved_at INTEGER,
  human_note TEXT
);

-- Beads Integration
CREATE TABLE IF NOT EXISTS beads_tasks (
  id INTEGER PRIMARY KEY,
  task_id TEXT UNIQUE NOT NULL,
  thread_id TEXT,
  status TEXT,
  assigned_agent_id INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER,
  FOREIGN KEY (assigned_agent_id) REFERENCES agents(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id);
CREATE INDEX IF NOT EXISTS idx_recipients_agent ON message_recipients(agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_project ON agents(project_id);
\`;
;
//# sourceMappingURL=schema.js.map