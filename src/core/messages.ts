import { AgentMailDB } from './database.js';
import { AgentManager } from './agents.js';

export interface Message {
    id: number;
    projectId: number;
    threadId: string;
    fromAgentId: number;
    subject: string;
    body: string;
    importance: 'low' | 'normal' | 'high';
    ackRequired: boolean;
    createdAt: number;
    senderName?: string; // Hydrated
}

export interface SendMessageParams {
    projectSlug: string;
    from: string;
    to: string[];
    subject: string;
    body: string;
    threadId?: string;
    importance?: 'low' | 'normal' | 'high';
    ackRequired?: boolean;
}

export class MessageManager {
    constructor(
        private db: AgentMailDB,
        private agents: AgentManager
    ) { }

    send(params: SendMessageParams): Message {
        const sender = this.agents.whois(params.projectSlug, params.from);
        if (!sender) throw new Error(`Sender agent '${params.from}' not found in project '${params.projectSlug}'`);

        const recipientIds: number[] = [];
        for (const recipientName of params.to) {
            const recipient = this.agents.whois(params.projectSlug, recipientName);
            if (!recipient) throw new Error(`Recipient agent '${recipientName}' not found`);
            // TODO: Check contact policy here
            recipientIds.push(recipient.id);
        }

        const threadId = params.threadId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const insertMsg = this.db.instance.prepare(`
      INSERT INTO messages (project_id, thread_id, from_agent_id, subject, body, importance, ack_required)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

        const txn = this.db.instance.transaction(() => {
            const msg = insertMsg.get(
                sender.projectId,
                threadId,
                sender.id,
                params.subject,
                params.body,
                params.importance || 'normal',
                params.ackRequired ? 1 : 0
            ) as any;

            const insertRecipient = this.db.instance.prepare(`
        INSERT INTO message_recipients (message_id, agent_id, kind)
        VALUES (?, ?, 'to')
      `);

            for (const rid of recipientIds) {
                insertRecipient.run(msg.id, rid);
            }

            return msg;
        });

        const msgRow = txn();
        return this.mapRowToMessage(msgRow, sender.name);
    }

    fetchInbox(projectSlug: string, agentName: string, limit = 20): Message[] {
        const agent = this.agents.whois(projectSlug, agentName);
        if (!agent) throw new Error(`Agent '${agentName}' not found`);

        const stmt = this.db.instance.prepare(`
      SELECT m.*, a.name as sender_name
      FROM messages m
      JOIN message_recipients mr ON m.id = mr.message_id
      JOIN agents a ON m.from_agent_id = a.id
      WHERE mr.agent_id = ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `);

        const rows = stmt.all(agent.id, limit) as any[];
        return rows.map(r => this.mapRowToMessage(r, r.sender_name));
    }

    fetchThread(projectSlug: string, threadId: string): Message[] {
        const stmt = this.db.instance.prepare(`
      SELECT m.*, a.name as sender_name
      FROM messages m
      JOIN agents a ON m.from_agent_id = a.id
      JOIN projects p ON m.project_id = p.id
      WHERE p.slug = ? AND m.thread_id = ?
      ORDER BY m.created_at ASC
    `);

        const rows = stmt.all(projectSlug, threadId) as any[];
        return rows.map(r => this.mapRowToMessage(r, r.sender_name));
    }

    private mapRowToMessage(row: any, senderName?: string): Message {
        return {
            id: row.id,
            projectId: row.project_id,
            threadId: row.thread_id,
            fromAgentId: row.from_agent_id,
            subject: row.subject,
            body: row.body,
            importance: row.importance,
            ackRequired: Boolean(row.ack_required),
            createdAt: row.created_at,
            senderName
        };
    }
}
