import { logger } from '../dist/utils/logger.js';
import { AgentMailDB } from '../dist/core/database.js';
import { AgentManager } from '../dist/core/agents.js';
import { HumanOverseer } from '../dist/human/overseer.js';
import { MessageManager } from '../dist/core/messages.js';
import { ContactManager } from '../dist/core/contacts.js';
import path from 'path';

// Mock console.error to capture logs
const logs = [];
const originalError = console.error;
console.error = (msg) => {
    logs.push(msg);
    // originalError(msg); // Uncomment to see output
};

// 1. Verify Logger
logger.info('test_event', { foo: 'bar' });
if (logs.length === 0) throw new Error('Logger failed to log');
const entry = JSON.parse(logs[0]);
if (entry.level !== 'info' || entry.event !== 'test_event' || entry.foo !== 'bar') {
    throw new Error('Log entry malformed');
}
console.log('✅ Logger verified');

// 2. Verify Dashboard Logic
const dbPath = path.resolve('test_polish.db');
const db = new AgentMailDB({ path: dbPath, verbose: false });
const agents = new AgentManager(db);
const contacts = new ContactManager(db);
const messages = new MessageManager(db, agents, contacts);
const overseer = new HumanOverseer(db, agents, messages);

// Populate some data
agents.register({ projectSlug: 'demo', name: 'DashAgent' });
overseer.requestApproval('test', 999);

const agentList = agents.list('demo');
const pendingApprovals = overseer.listPendingApprovals();

const metrics = {
    active_agents: agentList.length,
    pending_approvals: pendingApprovals.length,
    timestamp: new Date().toISOString(),
    status: 'healthy'
};

if (metrics.active_agents < 1 || metrics.pending_approvals < 1) {
    throw new Error('Dashboard metrics incorrect');
}
console.log('✅ Dashboard logic verified');
console.log(JSON.stringify(metrics, null, 2));

db.close();
