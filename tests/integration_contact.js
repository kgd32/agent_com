import { AgentMailDB } from '../dist/core/database.js';
import { AgentManager } from '../dist/core/agents.js';
import { MessageManager } from '../dist/core/messages.js';
import { ContactManager } from '../dist/core/contacts.js';
import path from 'path';

const dbPath = path.resolve('test_contact.db');
const db = new AgentMailDB({ path: dbPath, verbose: false });
const agents = new AgentManager(db);
const contacts = new ContactManager(db);
const messages = new MessageManager(db, agents, contacts);

async function run() {
    console.log('--- Registering Agents ---');
    const agentA = agents.register({ projectSlug: 'demo', name: 'AgentA', contactPolicy: 'open' });
    const agentB = agents.register({ projectSlug: 'demo', name: 'AgentB', contactPolicy: 'contacts_only' });
    console.log('Agent A (Open):', agentA.id);
    console.log('Agent B (Contacts Only):', agentB.id);

    console.log('\n--- Attempt 1: Message without contact ---');
    try {
        messages.send({
            projectSlug: 'demo',
            from: 'AgentA',
            to: ['AgentB'],
            subject: 'Hello',
            body: 'Can you hear me?'
        });
        console.error('❌ Failed: Should have thrown error');
    } catch (e) {
        console.log('✅ Success: Blocked by policy');
    }

    console.log('\n--- Requesting Contact ---');
    const link = contacts.requestContact(agentA.projectId, agentA.id, agentB.id, 'Need to chat');
    console.log('Contact Request:', link.status);

    console.log('\n--- Approving Contact ---');
    const app = contacts.respondContact(agentB.projectId, agentA.id, agentB.id, 'approved');
    console.log('Contact Approved:', app.status);

    console.log('\n--- Attempt 2: Message WITH contact ---');
    try {
        const msg = messages.send({
            projectSlug: 'demo',
            from: 'AgentA',
            to: ['AgentB'],
            subject: 'Hello again',
            body: 'Can you hear me now?'
        });
        console.log('✅ Success: Message sent', msg.id);
    } catch (e) {
        console.error('❌ Failed:', e.message);
    }

    db.close();
}

run().catch(console.error);
