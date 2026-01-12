import { AgentMailDB } from '../dist/core/database.js';
import { AgentManager } from '../dist/core/agents.js';
import path from 'path';

// Clean DB for test or assume empty since we deleted it
// Use verify_projects.db
const dbPath = path.resolve('verify_projects.db');
const db = new AgentMailDB({ path: dbPath, verbose: false });
const agents = new AgentManager(db);

async function run() {
    console.log('--- Registering Agent in Project "alpha" ---');
    agents.register({ projectSlug: 'alpha', name: 'Pilot' });

    console.log('--- Registering Agent in Project "beta" ---');
    agents.register({ projectSlug: 'beta', name: 'Tester' });

    console.log('\n--- Listing Projects ---');
    const projects = agents.listProjects();
    console.log('Projects found:', projects.length);
    projects.forEach(p => console.log(`- ${p.humanName} (${p.slug})`));

    if (projects.length !== 2) {
        throw new Error('Expected 2 projects');
    }

    const slugs = projects.map(p => p.slug);
    if (!slugs.includes('alpha') || !slugs.includes('beta')) {
        throw new Error('Missing expected projects');
    }

    console.log('✅ list_projects verified');
    db.close();
}

run().catch(console.error);
