import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { AgentMailDB } from '../core/database.js';
import { AgentManager } from '../core/agents.js';
import { MessageManager } from '../core/messages.js';
import { ContactManager } from '../core/contacts.js';
import { HumanOverseer } from '../human/overseer.js';
import { BeadsIntegration } from '../integrations/beads.js';
import { logger } from '../utils/logger.js';
import * as path from 'path';
import express from 'express';
import cors from 'cors';
import { createApi } from './api.js';
import crypto from 'crypto';

// Config
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'agent-mail.db');
const API_PORT = process.env.API_PORT || 3001;
const MCP_PORT = process.env.MCP_PORT || 3002;

// Initialize Core Managers (Singletons shared across all sessions)
const db = new AgentMailDB({ path: DB_PATH });
const agents = new AgentManager(db);
const contacts = new ContactManager(db);
const messages = new MessageManager(db, agents, contacts);
const overseer = new HumanOverseer(db, agents, messages);
const beads = new BeadsIntegration(db, agents, messages);

/**
 * Registers resources for an MCP server instance.
 */
function registerResources(s: Server, agents: AgentManager, overseer: HumanOverseer) {
    s.setRequestHandler(ListResourcesRequestSchema, async () => {
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

    s.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const uri = request.params.uri;
        if (uri === "resource://dashboard") {
            const agentList = agents.list('demo'); // Hardcoded default project for now
            const pendingApprovals = overseer.listPendingApprovals();

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
}

/**
 * Registers tools for an MCP server instance.
 */
function registerTools(
    s: Server,
    agents: AgentManager,
    contacts: ContactManager,
    messages: MessageManager,
    overseer: HumanOverseer,
    beads: BeadsIntegration
) {
    s.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: "register_agent",
                    description: "Register a new agent identity or update an existing one. Returns the agent details.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            projectSlug: { type: "string" },
                            name: { type: "string" },
                            program: { type: "string" },
                            model: { type: "string" },
                            contactPolicy: { type: "string", enum: ["open", "auto", "contacts_only"] }
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
                            from: { type: "string" },
                            to: { type: "array", items: { type: "string" } },
                            subject: { type: "string" },
                            body: { type: "string" },
                            threadId: { type: "string" },
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
                        properties: { projectSlug: { type: "string" } },
                        required: ["projectSlug"]
                    }
                },
                {
                    name: "list_projects",
                    description: "List all available projects.",
                    inputSchema: { type: "object", properties: {} }
                },
                {
                    name: "request_contact",
                    description: "Request permission to contact another agent.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            projectSlug: { type: "string" },
                            from: { type: "string" },
                            to: { type: "string" },
                            reason: { type: "string" }
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
                            from: { type: "string" },
                            to: { type: "string" },
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
                {
                    name: "send_human_message",
                    description: "Send a high-priority message from Human Overseer to agents.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            projectSlug: { type: "string" },
                            subject: { type: "string" },
                            body: { type: "string" },
                            to: { type: "array", items: { type: "string" } }
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
                    inputSchema: { type: "object", properties: {} }
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
                            agentName: { type: "string" }
                        }
                    }
                }
            ]
        };
    });

    s.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const correlationId = Math.random().toString(36).substr(2, 9);
        logger.info('tool_call_start', { correlationId, name, args });

        try {
            let result: any;
            switch (name) {
                case "register_agent":
                    result = { content: [{ type: "text", text: JSON.stringify(agents.register(args as any), null, 2) }] };
                    break;
                case "send_message":
                    result = { content: [{ type: "text", text: JSON.stringify(messages.send(args as any), null, 2) }] };
                    break;
                case "fetch_inbox":
                    const fParams = args as any;
                    result = { content: [{ type: "text", text: JSON.stringify(messages.fetchInbox(fParams.projectSlug, fParams.agentName, fParams.limit), null, 2) }] };
                    break;
                case "list_agents":
                    result = { content: [{ type: "text", text: JSON.stringify(agents.list((args as any).projectSlug), null, 2) }] };
                    break;
                case "list_projects":
                    result = { content: [{ type: "text", text: JSON.stringify(agents.listProjects(), null, 2) }] };
                    break;
                case "request_contact": {
                    const p = args as any;
                    const sender = agents.whois(p.projectSlug, p.from);
                    const target = agents.whois(p.projectSlug, p.to);
                    if (!sender || !target) throw new Error("Agent not found");
                    result = { content: [{ type: "text", text: JSON.stringify(contacts.requestContact(sender.projectId, sender.id, target.id, p.reason), null, 2) }] };
                    break;
                }
                case "respond_contact": {
                    const p = args as any;
                    const responder = agents.whois(p.projectSlug, p.from);
                    const requester = agents.whois(p.projectSlug, p.to);
                    if (!responder || !requester) throw new Error("Agent not found");
                    result = { content: [{ type: "text", text: JSON.stringify(contacts.respondContact(responder.projectId, requester.id, responder.id, p.decision), null, 2) }] };
                    break;
                }
                case "list_contacts": {
                    const p = args as any;
                    const agent = agents.whois(p.projectSlug, p.agentName);
                    if (!agent) throw new Error("Agent not found");
                    result = { content: [{ type: "text", text: JSON.stringify(contacts.listContacts(agent.projectId, agent.id), null, 2) }] };
                    break;
                }
                case "send_human_message":
                    result = { content: [{ type: "text", text: JSON.stringify(overseer.broadcast(args as any), null, 2) }] };
                    break;
                case "request_human_approval":
                    const raParams = args as any;
                    result = { content: [{ type: "text", text: JSON.stringify(overseer.requestApproval(raParams.entityType, raParams.entityId), null, 2) }] };
                    break;
                case "list_pending_approvals":
                    result = { content: [{ type: "text", text: JSON.stringify(overseer.listPendingApprovals(), null, 2) }] };
                    break;
                case "resolve_approval":
                    const resParams = args as any;
                    result = { content: [{ type: "text", text: JSON.stringify(overseer.resolveApproval(resParams.approvalId, resParams.decision, resParams.note), null, 2) }] };
                    break;
                case "link_task_to_thread":
                    const lParams = args as any;
                    await beads.linkTaskToThread(lParams.projectSlug, lParams.taskId, lParams.threadId);
                    result = { content: [{ type: "text", text: "Task linked successfully" }] };
                    break;
                case "update_task_status":
                    const uParams = args as any;
                    const task = await beads.updateTaskStatus(uParams.projectSlug, uParams.agentName, uParams.taskId, uParams.status, uParams.note);
                    result = { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
                    break;
                case "list_tasks":
                    result = { content: [{ type: "text", text: JSON.stringify(await beads.listTasks((args as any).agentName), null, 2) }] };
                    break;
                default:
                    throw new Error(`Unknown tool: ${name}`);
            }
            logger.info('tool_call_success', { correlationId, name });
            return result;
        } catch (error: any) {
            logger.error('tool_call_failed', { correlationId, name, error: error.message });
            return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
        }
    });
}

// Multi-Session Registry
const sessions = new Map<string, { transport: StreamableHTTPServerTransport; server: Server }>();

function createServerInstance(): Server {
    const s = new Server({ name: 'agent-mail', version: '1.0.0' }, { capabilities: { tools: {}, resources: { subscribe: true }, logging: {} } });
    registerResources(s, agents, overseer);
    registerTools(s, agents, contacts, messages, overseer, beads);
    s.onerror = (error) => logger.error('mcp_server_error', { error: error.message });
    return s;
}

// Express Apps
const app = express();
const mcpApp = express();

app.use(cors());
app.use(express.json());
mcpApp.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
mcpApp.use(express.json());

const requestLogger = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.info('http_request', { server: req.socket.localPort === Number(MCP_PORT) ? 'mcp' : 'api', method: req.method, url: req.url });
    next();
};

app.use(requestLogger);
mcpApp.use(requestLogger);
app.use('/api', createApi(db, agents, messages, contacts, beads, overseer));

// Port 3002: Dynamic MCP Session Handler
mcpApp.use(async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string;
    const isInit = req.body?.method === 'initialize' || (req.method === 'GET' && req.url === '/sse');

    if (sessionId && sessions.has(sessionId)) {
        const { transport } = sessions.get(sessionId)!;
        await transport.handleRequest(req, res, req.body);
        return;
    }

    if (isInit) {
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID(),
            onsessioninitialized: async (id) => {
                const server = createServerInstance();
                sessions.set(id, { transport, server });
                await server.connect(transport);
                logger.info('mcp_session_started', { sessionId: id });
            },
            onsessionclosed: (id) => {
                sessions.delete(id);
                logger.info('mcp_session_closed', { sessionId: id });
            }
        });
        await transport.handleRequest(req, res, req.body);
        return;
    }

    if (!res.headersSent) {
        res.status(400).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Session not found' }, id: req.body?.id || null });
    }
});

async function run() {
    app.listen(API_PORT, () => logger.info('api_startup', { port: API_PORT }));
    mcpApp.listen(MCP_PORT, () => logger.info('mcp_startup', { port: MCP_PORT }));

    if (process.env.MCP_TRANSPORT !== 'remote-only') {
        const s = createServerInstance();
        await s.connect(new StdioServerTransport());
        logger.info('stdio_startup');
    }
}

run().catch((e) => logger.error('fatal_error', { error: e.message }));
