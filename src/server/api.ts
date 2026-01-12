import express from 'express';
import cors from 'cors';
import { AgentMailDB } from '../core/database.js';
import { AgentManager } from '../core/agents.js';
import { MessageManager } from '../core/messages.js';
import { ContactManager } from '../core/contacts.js';
import { BeadsIntegration } from '../integrations/beads.js';
import { HumanOverseer } from '../human/overseer.js';

export function createApi(
    db: AgentMailDB,
    agents: AgentManager,
    messages: MessageManager,
    contacts: ContactManager,
    beads: BeadsIntegration,
    overseer: HumanOverseer
) {
    const router = express.Router();

    // Enable CORS for frontend development
    router.use(cors());
    router.use(express.json());

    // Projects
    router.get('/projects', (req, res) => {
        try {
            const projects = agents.listProjects();
            res.json(projects);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // Agents
    router.get('/agents', (req, res) => {
        try {
            const { project } = req.query;
            if (typeof project !== 'string') return res.status(400).json({ error: 'project param required' });

            const list = agents.list(project);
            res.json(list);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // Messages (Inbox/Project view)
    router.get('/messages', (req, res) => {
        try {
            const { project, agent, thread, limit } = req.query;

            if (typeof project !== 'string') return res.status(400).json({ error: 'project param required' });

            if (thread && typeof thread === 'string') {
                const msgs = messages.fetchThread(project, thread);
                return res.json(msgs);
            }

            if (agent && typeof agent === 'string') {
                const msgs = messages.fetchInbox(project, agent, Number(limit) || 50);
                return res.json(msgs);
            }

            // If no agent specified, maybe list all messages? (Admin view)
            // For now, let's just return empty or recent project messages if we implement that.
            // Let's implement a 'recent project messages' query for the "Master Inbox" view.
            const stmt = db.instance.prepare(`
        SELECT m.*, a.name as sender_name
        FROM messages m
        JOIN agents a ON m.from_agent_id = a.id
        JOIN projects p ON m.project_id = p.id
        WHERE p.slug = ?
        ORDER BY m.created_at DESC
        LIMIT ?
      `);
            const rows = stmt.all(project, Number(limit) || 50) as any[];
            // We need to map this manually since we don't have a public map function exposed on MessageManager
            // But we can just return the rows, the frontend can handle snake_case or we fix it.
            // MessageManager.mapRowToMessage is private.
            // Let's rely on MessageManager to expose a method or just duplicate the map logic here for speed.
            // Actually, let's just return what we have, but normalized to camelCase to match types.
            const mapped = rows.map(r => ({
                id: r.id,
                projectId: r.project_id,
                threadId: r.thread_id,
                fromAgentId: r.from_agent_id,
                subject: r.subject,
                body: r.body,
                importance: r.importance,
                ackRequired: Boolean(r.ack_required),
                createdAt: r.created_at,
                senderName: r.sender_name
            }));
            res.json(mapped);

        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // Beads Tasks
    router.get('/beads/tasks', async (req, res) => {
        try {
            const { agent } = req.query;
            const tasks = await beads.listTasks(agent as string | undefined);
            res.json(tasks);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // Dev Mode: Seed Data
    router.post('/dev/seed', async (req, res) => {
        try {
            const { project = 'demo' } = req.body;

            // Quick seed logic similar to our test script
            const sales = agents.register({ projectSlug: project, name: 'SalesBot', model: 'gpt-4o', contactPolicy: 'open' });
            const support = agents.register({ projectSlug: project, name: 'SupportBot', model: 'claude-3-5-sonnet', contactPolicy: 'contacts_only' });

            messages.send({
                projectSlug: project,
                from: 'SalesBot',
                to: ['SupportBot'],
                subject: 'System Check',
                body: 'Is the API working?',
                importance: 'normal'
            });

            res.json({ success: true, message: `Seeded project ${project}` });
        } catch (e: any) {
            // If it fails (e.g. contact policy), just return error
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}
