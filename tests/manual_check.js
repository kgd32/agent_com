import { AgentMailDB } from '../dist/core/database.js';
import { AgentManager } from '../dist/core/agents.js';
import { MessageManager } from '../dist/core/messages.js';
import path from 'path';

const dbPath = path.resolve('test.db');
const db = new AgentMailDB({ path: dbPath, verbose: true });
const agents = new AgentManager(db);
const messages = new MessageManager(db, agents);

console.log('Registering agent...');
const agentA = agents.register({ projectSlug: 'demo', name: 'AgentA' });
console.log('Agent A:', agentA);

const agentB = agents.register({ projectSlug: 'demo', name: 'AgentB' });
console.log('Agent B:', agentB);

console.log('Sending message...');
const msg = messages.send({
    projectSlug: 'demo',
    from: 'AgentA',
    to: ['AgentB'],
    subject: 'Hello',
    body: 'World'
});
console.log('Message sent:', msg);

console.log('Fetching inbox...');
const inbox = messages.fetchInbox('demo', 'AgentB');
console.log('Inbox for AgentB:', inbox);

db.close();
console.log('Done.');
