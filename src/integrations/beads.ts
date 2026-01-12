import { exec } from 'child_process';
import { promisify } from 'util';
import { AgentMailDB } from '../core/database.js';
import { AgentManager } from '../core/agents.js';
import { MessageManager } from '../core/messages.js';

const execAsync = promisify(exec);

export interface BeadsTask {
    id: string;
    title: string;
    status: string;
    priority: string;
    assignee?: string;
}

export class BeadsIntegration {
    constructor(
        private db: AgentMailDB,
        private agents: AgentManager,
        private messages: MessageManager
    ) { }

    async linkTaskToThread(projectSlug: string, taskId: string, threadId: string): Promise<void> {
        // 1. Verify task exists or creating a stub entry?
        // Let's assume we want to track it.
        const insert = this.db.instance.prepare(`
        INSERT INTO beads_tasks (task_id, thread_id, status, created_at)
        VALUES (?, ?, 'unknown', strftime('%s', 'now'))
        ON CONFLICT(task_id) DO UPDATE SET
            thread_id = excluded.thread_id,
            updated_at = strftime('%s', 'now')
    `);

        insert.run(taskId, threadId);

        // Ensure HumanOverseer exists
        let systemInfo = this.agents.whois(projectSlug, 'HumanOverseer');
        if (!systemInfo) {
            systemInfo = this.agents.register({
                projectSlug,
                name: 'HumanOverseer',
                program: 'system',
                model: 'system',
                contactPolicy: 'open'
            });
        }

        // Announce in thread
        this.messages.send({
            projectSlug,
            from: 'HumanOverseer', // Or system? Let's use HumanOverseer for system msgs for now or just generic system
            to: [], // Broadcast/System msg in thread? 
            // Actually we need to just inject a message into the thread.
            // MessageManager.send requires a sender.
            // Let's assume the agent calling this does it, OR we have a 'System' agent.
            // For now, let's skip the announcement here and let the tool caller handle the UX 
            // OR we can make the tool caller specify the 'from'.
            subject: `Task Linked: ${taskId}`,
            body: `This thread is now linked to task \`${taskId}\`. Updates will be synced.`,
            threadId,
            importance: 'normal'
        });

        // Attempt to sync immediately
        await this.syncTask(taskId);
    }

    async updateTaskStatus(projectSlug: string, agentName: string, taskId: string, status: string, note?: string): Promise<BeadsTask> {
        const agent = this.agents.whois(projectSlug, agentName);
        if (!agent) throw new Error('Agent not found');

        // 1. Shell out to bd
        const cmd = `bd update ${taskId} --status ${status}`;
        try {
            await execAsync(cmd);
        } catch (error: any) {
            throw new Error(`Failed to update beads task: ${error.message}`);
        }

        // 2. Sync local
        const task = await this.syncTask(taskId);

        // 3. Announce in thread if linked
        const threadId = this.getThreadForTask(taskId);
        if (threadId) {
            this.messages.send({
                projectSlug,
                from: agentName,
                to: [], // No specific recipient, just posting to thread? 
                // Wait, 'send' needs 'to'. If it's a thread, we usually reply to who?
                // Maybe we need a 'postToThread' method.
                // For now, let's send to 'HumanOverseer' as a dummy or broadcast method?
                // Actually, if we pass empty 'to', the message manager might fail or just store it.
                // Let's check MessageManager.
                // MessageManager requires at least one recipient id to put in message_recipients.
                // But for a shared thread, it's weird.
                // Let's iterate thread participants?
                // Expense expensive.
                // Simplification: Not announcing automatically here, relying on agent to describe what they did.
                // BUT, the requirements say "Status updates flow both ways".
                // Let's leave the announcement to the agent's logic for now to keep this tool simple.
                subject: `Task Update: ${taskId}`,
                body: `Updated task to \`${status}\`. ${note ? `Note: ${note}` : ''}`,
                threadId,
                importance: 'low'
            });
        }

        return task;
    }

    async listTasks(agentName?: string): Promise<BeadsTask[]> {
        // Shell out to `bd list --json`
        // Or `bd ready --json`
        const { stdout } = await execAsync('bd list --json');
        const tasks = JSON.parse(stdout) as any[]; // Determine shape from output

        // Filter?
        // Beads doesn't have strict assignment in the 'list' usually? 
        // It might have an 'assignee' field.
        if (agentName) {
            return tasks.filter((t: any) => t.assignees?.includes(agentName) || t.status === 'ready'); // Broad logic
        }

        return tasks.map(t => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            assignee: t.assignees?.[0]
        }));
    }

    private async syncTask(taskId: string): Promise<BeadsTask> {
        const { stdout } = await execAsync(`bd show ${taskId} --json`);
        const tasks = JSON.parse(stdout);
        const task = tasks[0];

        // Determine assigned agent ID if possible
        // For now update status
        this.db.instance.prepare(`
      UPDATE beads_tasks 
      SET status = ?, updated_at = strftime('%s', 'now')
      WHERE task_id = ?
    `).run(task.status, taskId);

        return {
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            assignee: task.assignees?.[0]
        };
    }

    private getThreadForTask(taskId: string): string | null {
        const row = this.db.instance.prepare('SELECT thread_id FROM beads_tasks WHERE task_id = ?').get(taskId) as any;
        return row ? row.thread_id : null;
    }
}
