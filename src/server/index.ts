import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { AgentMailDB } from '../core/database.js';
import { AgentManager } from '../core/agents.js';
import { MessageManager } from '../core/messages.js';
import { ContactManager } from '../core/contacts.js';
import * as path from 'path';

// Config
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'agent-mail.db');

// Initialize Core
const db = new AgentMailDB({ path: DB_PATH });
const agents = new AgentManager(db);
const contacts = new ContactManager(db);
const messages = new MessageManager(db, agents, contacts);

const server = new Server(
    {
        name: "agent-mail",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

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
            }
        ]
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case "register_agent": {
                const params = args as any;
                const agent = agents.register(params);
                return {
                    content: [{ type: "text", text: JSON.stringify(agent, null, 2) }]
                };
            }
            case "send_message": {
                const params = args as any;
                const msg = messages.send(params);
                return {
                    content: [{ type: "text", text: JSON.stringify(msg, null, 2) }]
                };
            }
            case "fetch_inbox": {
                const params = args as any;
                const msgs = messages.fetchInbox(params.projectSlug, params.agentName, params.limit);
                return {
                    content: [{ type: "text", text: JSON.stringify(msgs, null, 2) }]
                };
            }
            case "list_agents": {
                const params = args as any;
                const list = agents.list(params.projectSlug);
                return {
                    content: [{ type: "text", text: JSON.stringify(list, null, 2) }]
                };
            }
            case "request_contact": {
                const params = args as any;
                const sender = agents.whois(params.projectSlug, params.from);
                const target = agents.whois(params.projectSlug, params.to);
                if (!sender || !target) throw new Error("Agent not found");

                const result = contacts.requestContact(sender.projectId, sender.id, target.id, params.reason);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            case "respond_contact": {
                const params = args as any;
                const responder = agents.whois(params.projectSlug, params.from);
                const requester = agents.whois(params.projectSlug, params.to);
                if (!responder || !requester) throw new Error("Agent not found");

                const result = contacts.respondContact(responder.projectId, requester.id, responder.id, params.decision);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            case "list_contacts": {
                const params = args as any;
                const agent = agents.whois(params.projectSlug, params.agentName);
                if (!agent) throw new Error("Agent not found");

                const list = contacts.listContacts(agent.projectId, agent.id);
                return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error: any) {
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
    console.error("Fatal error:", error);
    process.exit(1);
});
