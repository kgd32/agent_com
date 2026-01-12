import { AgentMailDB } from '../core/database.js';
import { MessageManager, Message } from '../core/messages.js';
import { AgentManager } from '../core/agents.js';

export interface BroadcastParams {
    projectSlug: string;
    subject: string;
    body: string;
    to?: string[]; // If omitted, broadcast to all agents in project
}

export interface Approval {
    id: number;
    entityType: string;
    entityId: number;
    status: 'pending' | 'approved' | 'rejected';
    requestedAt: number;
    resolvedAt?: number;
    humanNote?: string;
}

export class HumanOverseer {
    constructor(
        private db: AgentMailDB,
        private agents: AgentManager,
        private messages: MessageManager
    ) { }

    broadcast(params: BroadcastParams): Message {
        // 1. Ensure "HumanOverseer" agent exists
        let human = this.agents.whois(params.projectSlug, 'HumanOverseer');
        if (!human) {
            human = this.agents.register({
                projectSlug: params.projectSlug,
                name: 'HumanOverseer',
                program: 'human',
                model: 'human',
                contactPolicy: 'open'
            });
        }

        // 2. Determine recipients
        let recipients = params.to;
        if (!recipients || recipients.length === 0) {
            const allAgents = this.agents.list(params.projectSlug);
            recipients = allAgents
                .filter(a => a.name !== 'HumanOverseer')
                .map(a => a.name);
        }

        // 3. Send message
        return this.messages.send({
            projectSlug: params.projectSlug,
            from: 'HumanOverseer',
            to: recipients,
            subject: `🚨 ${params.subject}`,
            body: params.body,
            importance: 'high',
            ackRequired: true,
            bypassPolicy: true
        });
    }

    requestApproval(entityType: string, entityId: number): Approval {
        const insert = this.db.instance.prepare(`
        INSERT INTO human_approvals (entity_type, entity_id, status, requested_at)
        VALUES (?, ?, 'pending', strftime('%s', 'now'))
        RETURNING *
    `);

        // Check if pending already?
        // For now simple insert
        const row = insert.get(entityType, entityId) as any;
        return this.mapRowToApproval(row);
    }

    resolveApproval(approvalId: number, decision: 'approved' | 'rejected', note?: string): Approval {
        const update = this.db.instance.prepare(`
        UPDATE human_approvals
        SET status = ?, resolved_at = strftime('%s', 'now'), human_note = ?
        WHERE id = ?
        RETURNING *
    `);

        const row = update.get(decision, note || null, approvalId) as any;
        if (!row) throw new Error(`Approval ${approvalId} not found`);

        // TODO: If approved, maybe trigger action? 
        // For this basic version, the agent polls or we notify.

        return this.mapRowToApproval(row);
    }

    listPendingApprovals(): Approval[] {
        const stmt = this.db.instance.prepare(`
        SELECT * FROM human_approvals WHERE status = 'pending' ORDER BY requested_at ASC
    `);
        const rows = stmt.all() as any[];
        return rows.map(this.mapRowToApproval);
    }

    private mapRowToApproval(row: any): Approval {
        return {
            id: row.id,
            entityType: row.entity_type,
            entityId: row.entity_id,
            status: row.status,
            requestedAt: row.requested_at,
            resolvedAt: row.resolved_at,
            humanNote: row.human_note
        };
    }
}
