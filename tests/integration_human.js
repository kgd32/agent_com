import { AgentMailDB } from '../dist/core/database.js';
import { AgentManager } from '../dist/core/agents.js';
import { MessageManager } from '../dist/core/messages.js';
import { ContactManager } from '../dist/core/contacts.js';
import { HumanOverseer } from '../dist/human/overseer.js';
import path from 'path';

const dbPath = path.resolve('test_human.db');
const db = new AgentMailDB({ path: dbPath, verbose: false });
const agents = new AgentManager(db);
const contacts = new ContactManager(db);
const messages = new MessageManager(db, agents, contacts);
const overseer = new HumanOverseer(db, agents, messages);

async function run() {
    console.log('--- Registering Agent ---');
    const agentA = agents.register({ projectSlug: 'demo', name: 'AgentA' });
    console.log('Agent:', agentA.name);

    console.log('\n--- Human Broadcast ---');
    const msg = overseer.broadcast({
        projectSlug: 'demo',
        subject: 'System Shutdown',
        body: 'Shutting down in 5 minutes.',
    });
    console.log('Broadcast Sent:', msg.id, msg.subject);

    // Verify reception
    const inbox = messages.fetchInbox('demo', 'AgentA');
    console.log('AgentA Inbox:', inbox.length, 'messages');
    console.log('Latest:', inbox[0].subject, 'from:', inbox[0].senderName);

    console.log('\n--- Request Approval ---');
    const req = overseer.requestApproval('task', 123);
    console.log('Requested Approval:', req.id, req.status);

    console.log('\n--- List Pending ---');
    const pending = overseer.listPendingApprovals();
    console.log('Pending count:', pending.length);

    console.log('\n--- Resolve Approval ---');
    const res = overseer.resolveApproval(req.id, 'approved', 'Looks good');
    console.log('Resolved:', res.status, 'Note:', res.humanNote);

    db.close();
}

run().catch(console.error);
