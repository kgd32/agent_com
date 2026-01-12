import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { AgentMailDB } from '../core/database.js';
import { AgentManager } from '../core/agents.js';
import { MessageManager } from '../core/messages.js';
import { ContactManager } from '../core/contacts.js';
import { HumanOverseer } from '../human/overseer.js';
import { BeadsIntegration } from '../integrations/beads.js';
import { logger } from '../utils/logger.js';
import * as path from 'path';

// Config
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'agent-mail.db');

// Initialize Core
try {
    logger.info('system_startup', { dbPath: DB_PATH });
} catch (e) {
    console.error("Failed to init logger", e);
}

const db = new AgentMailDB({ path: DB_PATH });
const agents = new AgentManager(db);
const contacts = new ContactManager(db);
const messages = new MessageManager(db, agents, contacts);
const overseer = new HumanOverseer(db, agents, messages);
const beads = new BeadsIntegration(db, agents, messages);

const server = new Server(
    {
        name: "agent-mail",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
            resources: {},
        },
    }
);

server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
        resources: [
            {
                uri: "resource://dashboard",
                name: "Agent Mail Dashboard",
                mimeType: "application/json",
                description: "Real-time metrics and system health"
            }
        ]
    };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    if (uri === "resource://dashboard") {
        const agentList = agents.list('demo'); // Hardcoded default project for now
        const pendingApprovals = overseer.listPendingApprovals();

        // Simple metrics gathering
        const metrics = {
            active_agents: agentList.length,
            pending_approvals: pendingApprovals.length,
            timestamp: new Date().toISOString(),
            status: 'healthy'
        };

        return {
            contents: [{
                uri,
                mimeType: "application/json",
                text: JSON.stringify(metrics, null, 2)
            }]
        };
    }
    throw new Error(`Resource not found: ${uri}`);
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "register_agent",
                description: "Register a new agent identity or update an existing one. Returns the agent details.",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectSlug: { type: "string", description: "The project/workspace identifier" },
                        name: { type: "string", description: "Agent name (e.g., 'GreenMountain'). Generated if omitted." },
                        program: { type: "string", description: "The AI program (e.g., 'claude-code')" },
                        model: { type: "string", description: "The AI model (e.g., 'claude-3-5-sonnet')" },
                        contactPolicy: { type: "string", enum: ["open", "auto", "contacts_only"], description: "Default is 'auto'" }
                    },
                    required: ["projectSlug"]
                }
            },
            {
                name: "send_message",
                description: "Send a message to other agents.",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectSlug: { type: "string" },
                        from: { type: "string", description: "Your agent name" },
                        to: { type: "array", items: { type: "string" }, description: "Recipient agent names" },
                        subject: { type: "string" },
                        body: { type: "string", description: "Markdown body" },
                        threadId: { type: "string", description: "Optional thread ID to reply to" },
                        importance: { type: "string", enum: ["low", "normal", "high"] },
                        ackRequired: { type: "boolean" }
                    },
                    required: ["projectSlug", "from", "to", "subject", "body"]
                }
            },
            {
                name: "fetch_inbox",
                description: "Fetch recent messages where you are a recipient.",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectSlug: { type: "string" },
                        agentName: { type: "string" },
                        limit: { type: "number" }
                    },
                    required: ["projectSlug", "agentName"]
                }
            },
            {
                name: "list_agents",
                description: "List active agents in the project.",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectSlug: { type: "string" }
                    },
                    required: ["projectSlug"]
                }
            },
            {
                name: "list_projects",
                description: "List all available projects.",
                inputSchema: {
                    type: "object",
                    properties: {},
                }
            },
            {
                name: "request_contact",
                description: "Request permission to contact another agent.",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectSlug: { type: "string" },
                        from: { type: "string", description: "Your agent name" },
                        to: { type: "string", description: "Target agent name" },
                        reason: { type: "string", description: "Why do you want to contact them?" }
                    },
                    required: ["projectSlug", "from", "to", "reason"]
                }
            },
            {
                name: "respond_contact",
                description: "Approve or deny a contact request.",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectSlug: { type: "string" },
                        from: { type: "string", description: "Your agent name (who is responding)" },
                        to: { type: "string", description: "Agent name who requested contact" },
                        decision: { type: "string", enum: ["approved", "denied"] }
                    },
                    required: ["projectSlug", "from", "to", "decision"]
                }
            },
            {
                name: "list_contacts",
                description: "List your approved contacts.",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectSlug: { type: "string" },
                        agentName: { type: "string" }
                    },
                    required: ["projectSlug", "agentName"]
                }
            },
            // Human Oversight Tools
            {
                name: "send_human_message",
                description: "Send a high-priority message from Human Overseer to agents.",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectSlug: { type: "string" },
                        subject: { type: "string" },
                        body: { type: "string" },
                        to: { type: "array", items: { type: "string" }, description: "Optional list of agent names. Defaults to all." }
                    },
                    required: ["projectSlug", "subject", "body"]
                }
            },
            {
                name: "request_human_approval",
                description: "Request human approval for an action.",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectSlug: { type: "string" },
                        entityType: { type: "string" },
                        entityId: { type: "number" }
                    },
                    required: ["projectSlug", "entityType", "entityId"]
                }
            },
            {
                name: "list_pending_approvals",
                description: "List pending human approvals.",
                inputSchema: {
                    type: "object",
                    properties: {},
                }
            },
            {
                name: "resolve_approval",
                description: "Approve or reject a request.",
                inputSchema: {
                    type: "object",
                    properties: {
                        approvalId: { type: "number" },
                        decision: { type: "string", enum: ["approved", "rejected"] },
                        note: { type: "string" }
                    },
                    required: ["approvalId", "decision"]
                }
            },
            // Beads Integration Tools
            {
                name: "link_task_to_thread",
                description: "Link a Beads task to a conversation thread.",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectSlug: { type: "string" },
                        taskId: { type: "string" },
                        threadId: { type: "string" }
                    },
                    required: ["projectSlug", "taskId", "threadId"]
                }
            },
            {
                name: "update_task_status",
                description: "Update a Beads task status and announce it.",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectSlug: { type: "string" },
                        agentName: { type: "string" },
                        taskId: { type: "string" },
                        status: { type: "string", enum: ["todo", "in_progress", "done"] },
                        note: { type: "string" }
                    },
                    required: ["projectSlug", "agentName", "taskId", "status"]
                }
            },
            {
                name: "list_tasks",
                description: "List tasks from Beads.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentName: { type: "string", description: "Filter by assignee (optional)" }
                    }
                }
            }
        ]
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const correlationId = Math.random().toString(36).substr(2, 9);

    logger.info('tool_call_start', { correlationId, name, args });

    try {
        let result: any;
        switch (name) {
            case "register_agent": {
                const params = args as any;
                const agent = agents.register(params);
                result = {
                    content: [{ type: "text", text: JSON.stringify(agent, null, 2) }]
                };
                break;
            }
            case "send_message": {
                const params = args as any;
                const msg = messages.send(params);
                result = {
                    content: [{ type: "text", text: JSON.stringify(msg, null, 2) }]
                };
                break;
            }
            case "fetch_inbox": {
                const params = args as any;
                const msgs = messages.fetchInbox(params.projectSlug, params.agentName, params.limit);
                result = {
                    content: [{ type: "text", text: JSON.stringify(msgs, null, 2) }]
                };
                break;
            }
            case "list_agents": {
                const params = args as any;
                const list = agents.list(params.projectSlug);
                result = {
                    content: [{ type: "text", text: JSON.stringify(list, null, 2) }]
                };
                break;
            }
            case "list_projects": {
                const list = agents.listProjects();
                result = {
                    content: [{ type: "text", text: JSON.stringify(list, null, 2) }]
                };
                break;
            }
            case "request_contact": {
                const params = args as any;
                const sender = agents.whois(params.projectSlug, params.from);
                const target = agents.whois(params.projectSlug, params.to);
                if (!sender || !target) throw new Error("Agent not found");

                const res = contacts.requestContact(sender.projectId, sender.id, target.id, params.reason);
                result = { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
                break;
            }
            case "respond_contact": {
                const params = args as any;
                const responder = agents.whois(params.projectSlug, params.from);
                const requester = agents.whois(params.projectSlug, params.to);
                if (!responder || !requester) throw new Error("Agent not found");

                const res = contacts.respondContact(responder.projectId, requester.id, responder.id, params.decision);
                result = { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
                break;
            }
            case "list_contacts": {
                const params = args as any;
                const agent = agents.whois(params.projectSlug, params.agentName);
                if (!agent) throw new Error("Agent not found");

                const list = contacts.listContacts(agent.projectId, agent.id);
                result = { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
                break;
            }
            case "send_human_message": {
                const params = args as any;
                const msg = overseer.broadcast(params);
                result = { content: [{ type: "text", text: JSON.stringify(msg, null, 2) }] };
                break;
            }
            case "request_human_approval": {
                const params = args as any;
                const app = overseer.requestApproval(params.entityType, params.entityId);
                result = { content: [{ type: "text", text: JSON.stringify(app, null, 2) }] };
                break;
            }
            case "list_pending_approvals": {
                const apps = overseer.listPendingApprovals();
                result = { content: [{ type: "text", text: JSON.stringify(apps, null, 2) }] };
                break;
            }
            case "resolve_approval": {
                const params = args as any;
                const app = overseer.resolveApproval(params.approvalId, params.decision, params.note);
                result = { content: [{ type: "text", text: JSON.stringify(app, null, 2) }] };
                break;
            }
            case "link_task_to_thread": {
                const params = args as any;
                await beads.linkTaskToThread(params.projectSlug, params.taskId, params.threadId);
                result = { content: [{ type: "text", text: "Task linked successfully" }] };
                break;
            }
            case "update_task_status": {
                const params = args as any;
                const task = await beads.updateTaskStatus(params.projectSlug, params.agentName, params.taskId, params.status, params.note);
                result = { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
                break;
            }
            case "list_tasks": {
                const params = args as any;
                const tasks = await beads.listTasks(params.agentName);
                result = { content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }] };
                break;
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }

        logger.info('tool_call_success', { correlationId, name });
        return result;

    } catch (error: any) {
        logger.error('tool_call_failed', { correlationId, name, error: error.message, stack: error.stack });
        return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true,
        };
    }
});

async function run() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Agent Mail MCP Server running on stdio");
}

run().catch((error) => {
    logger.error("fatal_server_error", { error: error.message });
    console.error("Fatal error:", error);
    process.exit(1);
});
