"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const zod_1 = require("zod");
const database_1 = require("../core/database");
const agents_1 = require("../core/agents");
const messages_1 = require("../core/messages");
const path = __importStar(require("path"));
// Config
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'agent-mail.db');
// Initialize Core
const db = new database_1.AgentMailDB({ path: DB_PATH });
const agents = new agents_1.AgentManager(db);
const messages = new messages_1.MessageManager(db, agents);
const server = new index_js_1.Server({
    name: "agent-mail",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
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
            }
        ]
    };
});
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case "register_agent": {
                const params = args;
                const agent = agents.register(params);
                return {
                    content: [{ type: "text", text: JSON.stringify(agent, null, 2) }]
                };
            }
            case "send_message": {
                const params = args;
                const msg = messages.send(params);
                return {
                    content: [{ type: "text", text: JSON.stringify(msg, null, 2) }]
                };
            }
            case "fetch_inbox": {
                const params = args;
                const msgs = messages.fetchInbox(params.projectSlug, params.agentName, params.limit);
                return {
                    content: [{ type: "text", text: JSON.stringify(msgs, null, 2) }]
                };
            }
            case "list_agents": {
                const params = args;
                const list = agents.list(params.projectSlug);
                return {
                    content: [{ type: "text", text: JSON.stringify(list, null, 2) }]
                };
            }
            default:
                throw new Error(`Unknown tool: \${name}\`);
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: \`Error: \${error.message}\` }],
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
                );
        }
    }
    finally { }
});
//# sourceMappingURL=index.js.map