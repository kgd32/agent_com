import { AgentMailDB } from '../dist/core/database.js';
import { AgentManager } from '../dist/core/agents.js';
import { MessageManager } from '../dist/core/messages.js';
import { ContactManager } from '../dist/core/contacts.js';
import { BeadsIntegration } from '../dist/integrations/beads.js';
import path from 'path';

const dbPath = path.resolve('test_beads.db');
const db = new AgentMailDB({ path: dbPath, verbose: false });
const agents = new AgentManager(db);
const contacts = new ContactManager(db);
const messages = new MessageManager(db, agents, contacts);
const beads = new BeadsIntegration(db, agents, messages);

const TEST_TASK_ID = 'agent_com-s3d';

async function run() {
    console.log('--- Registering Agent ---');
    const agent = agents.register({ projectSlug: 'demo', name: 'WorkerBot' });
    console.log('Agent:', agent.name);

    console.log(`\n--- Linking Task ${TEST_TASK_ID} ---`);
    const threadId = 'thread-beads-test';
    await beads.linkTaskToThread('demo', TEST_TASK_ID, threadId);
    console.log('Linked to thread:', threadId);

    console.log('\n--- Updating Status ---');
    // Need to use valid status: open, in_progress, done
    const updated = await beads.updateTaskStatus('demo', 'WorkerBot', TEST_TASK_ID, 'in_progress', 'Starting work via integration test');
    console.log('Updated Status:', updated.status);

    if (updated.status !== 'in_progress') {
        throw new Error('Status update failed');
    }

    console.log('\n--- Verifying Thread Message ---');
    const msgs = messages.fetchThread('demo', threadId);
    console.log('Thread messages:', msgs.length);
    msgs.forEach(m => console.log(`[${m.senderName}] ${m.subject}: ${m.body}`));

    db.close();
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
