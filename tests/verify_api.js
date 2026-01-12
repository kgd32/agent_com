import http from 'http';
import { spawn } from 'child_process';
import path from 'path';

const API_PORT = 3001;
const SERVER_PATH = path.resolve('dist/server/index.js');

function request(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: API_PORT,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    reject(new Error(`Status ${res.statusCode}: ${data}`));
                } else {
                    resolve(JSON.parse(data));
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function run() {
    console.log('--- Starting Server ---');
    const server = spawn('node', [SERVER_PATH], {
        env: { ...process.env, API_PORT: API_PORT.toString(), DATABASE_PATH: 'api_test.db' },
        stdio: ['ignore', 'pipe', 'pipe'] // Ignore stdin so MCP transport doesn't hang waiting for input
    });

    server.stderr.on('data', (data) => {
        console.log(`[Stderr]: ${data.toString().trim()}`);
    });

    // Give it a second to start
    await new Promise(r => setTimeout(r, 5000));

    try {
        console.log('\n--- Seeding Data ---');
        await request('/api/dev/seed', 'POST', { project: 'api-test' });
        console.log('✅ Seeded');

        console.log('\n--- Fetching Projects ---');
        const projects = await request('/api/projects');
        console.log('Projects:', projects);
        if (!projects.find(p => p.slug === 'api-test')) throw new Error('Project not found');

        console.log('\n--- Fetching Agents ---');
        const agents = await request('/api/agents?project=api-test');
        console.log('Agents:', agents.length);
        if (agents.length !== 2) throw new Error('Expected 2 agents');

        console.log('\n--- Fetching Inbox ---');
        // Fetch SalesBot inbox (sent by ManagerBot or similar, wait seed script sent Sales -> Support)
        // Seed script: Sales -> Support. So Support inbox has it.
        const messages = await request('/api/messages?project=api-test&agent=SupportBot');
        console.log('Inbox Messages:', messages.length);
        if (messages.length < 1) throw new Error('Expected messages');

        console.log('\n✅ API Verified Successfully');

    } catch (e) {
        console.error('❌ Test Failed:', e);
        process.exit(1);
    } finally {
        server.kill();
    }
}

run();
