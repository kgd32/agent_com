import { Command } from 'commander'; // Wait, let's use a simpler approach to avoid adding deps
import { spawn } from 'child_process';
import * as fs from 'fs';
import { logger } from '../utils/logger.js';

/**
 * Simple CLI to bridge agent-mail server and Gemini CLI hooks.
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3001/api';

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (command === 'register') {
        const agentName = getArg('--name') || process.env.AGENT_NAME;
        const projectSlug = getArg('--project') || process.env.PROJECT_SLUG || 'demo';
        const model = getArg('--model') || 'gemini-2.0-flash-exp';

        if (!agentName) {
            console.error('Error: --name <name> required');
            process.exit(1);
        }

        await registerAgent(agentName, projectSlug, model);

    } else if (command === 'spawn') {
        // agent-mail spawn --name WorkerBot --project demo
        const agentName = getArg('--name');
        const projectSlug = getArg('--project') || process.env.PROJECT_SLUG || 'demo';
        const model = getArg('--model') || 'gemini-2.0-flash-exp';

        if (!agentName) {
            console.error('Error: --name <name> required for spawning');
            process.exit(1);
        }

        // 1. Register
        const success = await registerAgent(agentName, projectSlug, model);
        if (!success) process.exit(1);

        // 2. Spawn Gemini
        const isBackground = args.includes('--background') || args.includes('-b') || args.includes('-d');

        console.log(`[CLI] Spawning Gemini agent '${agentName}'${isBackground ? ' in background' : ''}...`);

        if (isBackground) {
            if (process.platform === 'win32') {
                // Windows: Use Powershell Start-Process -WindowStyle Hidden
                // This is the most reliable way to prevent pop-ups
                // We construct a PS command that sets env vars then starts the process hidden
                const psCommand = `
                    $env:GEMINI_AGENT_NAME='${agentName}';
                    $env:PROJECT_SLUG='${projectSlug}';
                    Start-Process gemini -WindowStyle Hidden -RedirectStandardOutput '.\\${agentName}.log' -RedirectStandardError '.\\${agentName}.error.log' -PassThru
                `;

                // Spawn powershell to execute this command
                const child = spawn('powershell', ['-NoProfile', '-Command', psCommand], {
                    detached: true,
                    stdio: 'ignore', // We interpret output via file redirection in the PS command
                    windowsHide: true // Hide this launcher powershell
                });
                child.unref(); // Don't wait for it
                console.log(`[CLI] Spawned background agent '${agentName}'. Logs: ${agentName}.log`);
                process.exit(0);

            } else {
                // Linux/Mac (Previous logic)
                const out = fs.openSync(`./${agentName}.log`, 'a');
                const err = fs.openSync(`./${agentName}.error.log`, 'a');
                const child = spawn('gemini', [], {
                    detached: true,
                    stdio: ['ignore', out, err],
                    env: {
                        ...process.env,
                        GEMINI_AGENT_NAME: agentName,
                        PROJECT_SLUG: projectSlug
                    },
                    shell: true
                });
                child.unref();
                console.log(`[CLI] Background PID: ${child.pid}. Logs: ${agentName}.log`);
                process.exit(0);
            }
        } else {
            // We assume 'gemini' is in the PATH (the powershell script or bin)
            // On Windows it might be 'gemini.ps1' or just 'gemini' if shimmed.
            // We generally want to inherit stdio so we can see what it does.
            const child = spawn('gemini', [], {
                stdio: 'inherit',
                env: {
                    ...process.env,
                    GEMINI_AGENT_NAME: agentName,
                    PROJECT_SLUG: projectSlug
                },
                shell: true // Needed to find batch files/ps1 on Windows often
            });

            child.on('close', (code) => {
                console.log(`[CLI] Agent '${agentName}' exited with code ${code}`);
                process.exit(code || 0);
            });
        }

    } else if (command === 'check') {
        const agentName = getArg('--agent') || process.env.AGENT_NAME;
        const projectSlug = getArg('--project') || process.env.PROJECT_SLUG || 'demo';

        if (!agentName) {
            console.error('Error: --agent <name> required');
            process.exit(1);
        }

        try {
            // 1. Fetch unread messages
            // Default to unreadOnly=true unless --all is passed
            const unreadOnly = !args.includes('--all');
            const msgRes = await fetch(`${API_BASE}/messages?project=${projectSlug}&agent=${agentName}&unreadOnly=${unreadOnly.toString()}`);
            const messages = await msgRes.json() as any[];

            // 2. Fetch linked beads tasks
            const taskRes = await fetch(`${API_BASE}/beads/tasks?agent=${agentName}`);
            const tasks = await taskRes.json() as any[];

            // Logic: If there is unread mail or active tasks, prompt the agent
            if (messages.length > 0 || tasks.length > 0) {
                const instructions = [];
                const msgIdsToMarkRead: number[] = [];

                if (messages.length > 0) {
                    instructions.push(`You have ${messages.length} new messages.`);
                    // Show up to 3 recent messages
                    for (const msg of messages.slice(0, 3)) {
                        instructions.push(`From ${msg.senderName}: "${msg.subject}"`);
                        msgIdsToMarkRead.push(msg.id);
                    }
                }

                if (tasks.length > 0) {
                    const activeTasks = tasks.filter(t => t.status !== 'done');
                    if (activeTasks.length > 0) {
                        instructions.push(`You have ${activeTasks.length} active tasks.`);
                        instructions.push(`Priority: ${activeTasks[0].title}`);
                    }
                }

                if (instructions.length > 0) {
                    console.log(JSON.stringify({
                        message: `[AGENT MAIL] ${instructions.join(' ')} \n\nPlease use the agent-mail MCP tools to read full details or respond.`
                    }));
                }

                // 3. Mark messages as read (Auto-read)
                if (msgIdsToMarkRead.length > 0) {
                    await fetch(`${API_BASE}/messages/read`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            projectSlug,
                            agentName,
                            messageIds: msgIdsToMarkRead
                        })
                    });
                }
            }
        } catch (e: any) {
            // Silently fail or log error to stderr to avoid breaking hook output
            console.error(`CLI Error: ${e.message}`);
        }
    } else {
        console.log('Usage: agent-mail check --agent <name> [--project <slug>]');
    }
}

function getArg(name: string): string | undefined {
    const idx = process.argv.indexOf(name);
    if (idx > -1 && process.argv[idx + 1]) {
        return process.argv[idx + 1];
    }
    return undefined;
}
main().catch(e => {
    console.error(e);
    process.exit(1);
});

async function registerAgent(name: string, projectSlug: string, model: string): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE}/agents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectSlug,
                name: name,
                program: 'gemini-cli',
                model,
                contactPolicy: 'auto'
            })
        });
        const json = await res.json();
        if (res.ok) {
            console.log(JSON.stringify({ message: `Agent '${name}' registered successfully in project '${projectSlug}'.` }));
            return true;
        } else {
            console.error(`Error: ${json.error}`);
            return false;
        }
    } catch (e: any) {
        console.error(`CLI Error: ${e.message}`);
        return false;
    }
}
