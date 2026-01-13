# Agent Mail Web UI - UX/UI Design Plan

> **Purpose**: This document defines the complete user experience for the Agent Mail web interface, where humans orchestrate and communicate with AI agents.

---

## 🎯 Core Principles

1. **Human as Orchestrator**: The UI empowers humans to guide, monitor, and intervene in agent workflows
2. **Context Preservation**: Every interaction maintains project context and conversation history
3. **Clarity Over Complexity**: Simple, focused interfaces for each task
4. **Real-time Awareness**: Users see agent activity and status at a glance
5. **Safety First**: Critical actions (broadcast, delete) require confirmation

---

## 📐 Information Architecture

```
┌─ Header ────────────────────────────────────────────────┐
│  AgentMail  [Mail] [Tasks] [Broadcast]    Project: demo │
└──────────────────────────────────────────────────────────┘
┌─ Main Content ──────────────────────────────────────────┐
│                                                          │
│  [Current View: Mail / Tasks / Broadcast]               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Navigation Structure

**Primary Navigation** (Header Tabs):
- **Mail**: Read and compose messages with agents
- **Tasks**: Kanban board for Beads task management
- **Broadcast**: Emergency communication channel

**Secondary Navigation** (Contextual):
- Project Switcher (always visible in header)
- Agent Filter (in Mail sidebar)
- Task Status Filters (in Tasks view)

---

## 📧 Mail View - Detailed UX

### Layout: 3-Column Design

```
┌─────────────┬──────────────┬─────────────────────────┐
│  Sidebar    │ Thread List  │  Message View           │
│  (256px)    │  (384px)     │  (flex-1)               │
├─────────────┼──────────────┼─────────────────────────┤
│ Folders     │ Search       │ [Toolbar]               │
│ • Inbox     │              │ Subject: "..."          │
│ • Sent      │ [Thread 1]   │ From: AgentName         │
│ • Drafts    │ [Thread 2]   │                         │
│             │ [Thread 3]   │ [Message Timeline]      │
│ Agents      │              │                         │
│ • All       │              │ [Compose Reply Box]     │
│ • Alice     │              │                         │
│ • Bob       │              │                         │
└─────────────┴──────────────┴─────────────────────────┘
```

### User Flows

#### 1. **Reading Messages**
1. User selects agent filter (or "All Mail")
2. Thread list updates to show relevant conversations
3. User clicks thread → Message view loads
4. Messages display chronologically with sender avatars
5. User can scroll through conversation history

**Key Features**:
- **Unread Indicator**: Bold text + dot for unread threads
- **Importance Badge**: 🔴 High, 🟡 Normal, 🔵 Low
- **Ack Required**: ⚠️ icon if acknowledgment needed
- **Relative Timestamps**: "2 hours ago" for recent, full date for old

#### 2. **Composing New Message**
**Trigger**: Click "Compose" button (floating action button in bottom-right)

**Compose Modal**:
```
┌─ Compose Message ─────────────────────────────┐
│                                                │
│  To: [Agent Dropdown ▼]                       │
│      [+ Add recipient]                        │
│                                                │
│  Subject: [________________]                  │
│                                                │
│  Message:                                      │
│  ┌────────────────────────────────────────┐   │
│  │                                        │   │
│  │  [Rich text editor / Markdown]         │   │
│  │                                        │   │
│  └────────────────────────────────────────┘   │
│                                                │
│  Options:                                      │
│  ☐ Require Acknowledgment                     │
│  Importance: ○ Low ● Normal ○ High            │
│                                                │
│  [Cancel]                      [Send Message] │
└────────────────────────────────────────────────┘
```

**Validation**:
- At least one recipient required
- Subject required (min 3 chars)
- Body required (min 10 chars)
- Contact policy check (show warning if blocked, offer to request contact)

**Success State**:
- Modal closes
- New message appears in "Sent" folder
- Toast notification: "Message sent to AgentName"

#### 3. **Replying to Messages**
**Trigger**: Click "Reply" button in message view

**Reply Box** (inline, at bottom of message view):
```
┌─ Reply to AgentName ──────────────────────────┐
│                                                │
│  [Text area - auto-focused]                   │
│                                                │
│  [Cancel]  [Attach Context]  [Send Reply]     │
└────────────────────────────────────────────────┘
```

**Features**:
- Auto-populates `threadId` (maintains conversation)
- Auto-sets recipient to original sender
- Subject inherited from thread
- Keyboard shortcut: `Cmd/Ctrl + Enter` to send

#### 4. **Managing Drafts**
**Auto-save**:
- Compose/reply text auto-saves to localStorage every 5 seconds
- Drafts persist across page refreshes
- Drafts folder shows all unsent messages

**Draft Actions**:
- Resume editing (click draft)
- Delete draft (swipe left or trash icon)
- Send draft (complete and send)

---

## 📢 Broadcast View - Emergency Communication

### Purpose
Broadcast is a **separate, high-priority channel** for urgent, system-wide announcements that bypass normal messaging workflows.

### Layout: Minimal Chat Interface

```
┌─ Broadcast to All Agents ─────────────────────┐
│                                                │
│  ⚠️  EMERGENCY CHANNEL                         │
│  Messages sent here go to ALL agents in this  │
│  project immediately, bypassing contact rules. │
│                                                │
│  ┌─ Broadcast History ───────────────────┐    │
│  │                                        │    │
│  │  [2h ago] You: "Stop all deployments" │    │
│  │  [1d ago] You: "New API keys deployed"│    │
│  │                                        │    │
│  └────────────────────────────────────────┘    │
│                                                │
│  ┌─ New Broadcast ───────────────────────┐    │
│  │ Subject: [___________________________] │    │
│  │                                        │    │
│  │ Message:                               │    │
│  │ ┌────────────────────────────────────┐ │    │
│  │ │                                    │ │    │
│  │ │                                    │ │    │
│  │ └────────────────────────────────────┘ │    │
│  │                                        │    │
│  │ Recipients: All agents in "demo"      │    │
│  │                                        │    │
│  │ [Cancel]              [🚨 Broadcast]  │    │
│  └────────────────────────────────────────┘    │
└────────────────────────────────────────────────┘
```

### User Flow

1. **Access**: Click "Broadcast" tab in header
2. **View History**: See past broadcasts (read-only timeline)
3. **Compose Broadcast**:
   - Enter subject (required)
   - Enter message (required, min 20 chars)
   - Review recipients (shows count: "12 agents")
4. **Confirmation Modal**:
   ```
   ⚠️  Confirm Broadcast
   
   You are about to send a HIGH PRIORITY message to:
   • 12 agents in project "demo"
   
   Subject: "Stop all deployments"
   
   This action cannot be undone.
   
   [Cancel]  [Yes, Broadcast]
   ```
5. **Success**: Toast + message appears in history

### Design Notes
- **Visual Distinction**: Orange/red accent color (vs. blue for mail)
- **Icon**: 📢 megaphone icon in header
- **Confirmation Required**: Always show confirmation modal
- **Audit Trail**: All broadcasts logged with timestamp + human name

---

## 🎨 Visual Design System

### Color Palette
- **Primary**: Blue (#3b82f6) - Mail, normal actions
- **Urgent**: Orange (#f97316) - Broadcast, warnings
- **Success**: Green (#10b981) - Confirmations, sent status
- **Muted**: Gray (#6b7280) - Secondary text, borders

### Typography
- **Headers**: Inter, 600 weight
- **Body**: Inter, 400 weight
- **Monospace**: JetBrains Mono (for agent names, IDs)

### Spacing
- **Base unit**: 4px (Tailwind's spacing scale)
- **Component padding**: 16px (p-4)
- **Section gaps**: 24px (gap-6)

### Interactive States
- **Hover**: Subtle background change (bg-accent)
- **Active**: Border highlight (border-primary)
- **Focus**: Ring outline (ring-2 ring-primary)
- **Disabled**: Opacity 50% + cursor-not-allowed

---

## 🔧 Technical Requirements

### API Endpoints Needed

#### Messages
- `POST /api/messages` - Send new message
- `POST /api/messages/:threadId/reply` - Reply to thread
- `GET /api/messages/drafts` - List drafts
- `POST /api/messages/drafts` - Save draft
- `DELETE /api/messages/drafts/:id` - Delete draft

#### Broadcast
- `POST /api/broadcast` - Send broadcast message
- `GET /api/broadcast/history` - List past broadcasts

#### Agents
- `GET /api/agents/:name/status` - Get agent online status
- `POST /api/agents/:name/contact` - Request contact permission

### MCP Tools to Expose
All existing MCP tools should be accessible via API:
- ✅ `send_message` → `POST /api/messages`
- ✅ `send_human_message` → `POST /api/broadcast`
- ✅ `fetch_inbox` → `GET /api/messages`
- ✅ `request_contact` → `POST /api/agents/:name/contact`
- ✅ `respond_contact` → `POST /api/contacts/:id/respond`
- ✅ `list_contacts` → `GET /api/contacts`

### State Management
- **React Query**: Cache messages, agents, threads
- **LocalStorage**: Drafts, UI preferences
- **Context**: Current project, selected agent filter

### Real-time Updates (Future)
- WebSocket connection for live message notifications
- Polling fallback (every 30s) for now

---

## 🎭 User Personas & Scenarios

### Persona 1: "Sarah - Project Manager"
**Goal**: Coordinate 5 AI agents working on a web app

**Daily Workflow**:
1. Opens Mail → Checks "All Mail" for overnight activity
2. Reads thread from DesignAgent about UI mockups
3. Replies with feedback and approval
4. Switches to Tasks → Moves "Implement Login" to "Done"
5. Composes new message to BackendAgent: "Start API integration"

**Pain Points** (to solve):
- Needs to see which agents are waiting for her response
- Wants to filter by "Requires Acknowledgment"
- Needs quick access to related Beads tasks from messages

### Persona 2: "Mike - DevOps Engineer"
**Goal**: Monitor agent deployments and intervene when needed

**Critical Scenario**:
1. Notices deployment agent is about to push to production
2. Clicks "Broadcast" tab
3. Types: "STOP - Critical bug found in auth module"
4. Confirms broadcast → All agents receive immediately
5. Switches to Mail → Composes detailed message to DeployAgent with fix instructions

**Pain Points** (to solve):
- Needs instant "stop everything" button
- Wants to see agent acknowledgments of broadcast
- Needs audit trail of all broadcasts

---

## 🚀 Implementation Phases

### Phase 1: Core Messaging (Week 1)
- [ ] Compose message modal
- [ ] Reply functionality
- [ ] Draft auto-save
- [ ] API endpoints for send/reply

### Phase 2: Broadcast System (Week 1)
- [ ] Broadcast view UI
- [ ] Broadcast history
- [ ] Confirmation modal
- [ ] API endpoint + MCP integration

### Phase 3: Polish & Features (Week 2)
- [ ] Keyboard shortcuts
- [ ] Unread indicators
- [ ] Contact request flow
- [ ] Message search
- [ ] Attachment support (future)

### Phase 4: Real-time (Week 3)
- [ ] WebSocket integration
- [ ] Live message notifications
- [ ] Agent online status
- [ ] Typing indicators

---

## ✅ Success Metrics

**Usability**:
- User can send first message within 30 seconds of opening app
- Broadcast reaches all agents within 5 seconds
- Zero contact policy violations (UI prevents invalid sends)

**Performance**:
- Message list loads in <500ms
- Compose modal opens in <100ms
- Search results appear in <200ms

**Reliability**:
- 100% message delivery (no lost messages)
- Drafts never lost (auto-save + localStorage backup)
- Broadcast confirmation prevents accidental sends

---

## 📝 Open Questions

1. **Message Formatting**: Support Markdown? Rich text? Plain text only?
   - **Recommendation**: Start with plain text + Markdown preview

2. **Attachments**: Should humans be able to attach files to messages?
   - **Recommendation**: Phase 2 feature - allow file URLs for now

3. **Agent Replies**: Should agents be able to reply via UI or only via MCP?
   - **Recommendation**: Agents use MCP only; UI is human-only

4. **Multi-project**: How to handle users managing 10+ projects?
   - **Recommendation**: Add project search/filter in header dropdown

5. **Notifications**: Browser notifications for new messages?
   - **Recommendation**: Yes, but require user permission first

---

## 🎨 Wireframe Summary

### Mail View States
1. **Empty State**: "No messages yet. Compose your first message to an agent."
2. **Loading State**: Skeleton loaders for thread list
3. **Error State**: "Failed to load messages. [Retry]"
4. **No Selection**: "Select a thread to view messages"

### Broadcast View States
1. **Empty History**: "No broadcasts sent yet."
2. **Sending**: Loading spinner + "Broadcasting..."
3. **Success**: Green checkmark + "Broadcast sent to 12 agents"
4. **Error**: Red alert + "Failed to broadcast. [Retry]"

---

## 🔐 Security Considerations

1. **Contact Policy Enforcement**: UI must respect agent contact policies
2. **Broadcast Confirmation**: Always require explicit confirmation
3. **Audit Logging**: Log all human actions (send, broadcast, delete)
4. **XSS Prevention**: Sanitize all message bodies before rendering
5. **CSRF Protection**: Use tokens for all POST requests

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-12  
**Owner**: Agent Mail Team
