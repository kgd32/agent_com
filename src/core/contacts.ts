import { AgentMailDB } from './database.js';

export interface AgentLink {
    id: number;
    projectId: number;
    fromAgentId: number;
    toAgentId: number;
    status: 'pending' | 'approved' | 'denied';
    reason?: string;
    createdAt: number;
    expiresAt?: number;
}

export type ContactPolicy = 'open' | 'auto' | 'contacts_only';

export class ContactManager {
    constructor(private db: AgentMailDB) { }

    canMessage(
        projectId: number,
        fromAgentId: number,
        toAgentId: number,
        recipientPolicy: ContactPolicy
    ): boolean {
        if (recipientPolicy === 'open') return true;

        // Check for approved link
        const link = this.getLink(projectId, fromAgentId, toAgentId);
        if (link && link.status === 'approved') {
            if (link.expiresAt && link.expiresAt < Date.now() / 1000) {
                return false; // Expired
            }
            return true;
        }

        if (recipientPolicy === 'auto') {
            // TODO: Implement heuristics (shared thread, etc.)
            // For now, auto only if link exists? Or auto-approve on request?
            // Guide says: "check heuristics - Same thread participants, Recent shared context, Approved link"
            // Simplest auto: allow if they are in the same project? No, that's 'open'.
            // Let's implement auto-approve on request logic in requestContact, but here strictly check if allowed.
            // If 'auto', we might be lenient. But sticking to explicit links is safer.
            // Let's check if there is a pending link? No.
            // For now, fail safe: need approved link unless 'open'.
            return false;
        }

        // contacts_only
        return false;
    }

    requestContact(
        projectId: number,
        fromAgentId: number,
        toAgentId: number,
        reason?: string
    ): AgentLink {
        const insert = this.db.instance.prepare(`
      INSERT INTO agent_links (project_id, from_agent_id, to_agent_id, status, reason, created_at)
      VALUES (?, ?, ?, 'pending', ?, strftime('%s', 'now'))
      ON CONFLICT(project_id, from_agent_id, to_agent_id) DO UPDATE SET
        status = 'pending',
        reason = excluded.reason,
        created_at = strftime('%s', 'now')
      RETURNING *
    `);

        const row = insert.get(projectId, fromAgentId, toAgentId, reason) as any;
        return this.mapRowToLink(row);
    }

    respondContact(
        projectId: number,
        fromAgentId: number, // The agent who requested (subject of the link)
        toAgentId: number,   // The agent who is responding (target of the link)
        status: 'approved' | 'denied'
    ): AgentLink {
        const expiresAt = status === 'approved'
            ? Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
            : null;

        const update = this.db.instance.prepare(`
      UPDATE agent_links
      SET status = ?, expires_at = ?
      WHERE project_id = ? AND from_agent_id = ? AND to_agent_id = ?
      RETURNING *
    `);

        const row = update.get(status, expiresAt, projectId, fromAgentId, toAgentId) as any;
        if (!row) throw new Error('Contact request not found');
        return this.mapRowToLink(row);
    }

    listContacts(projectId: number, agentId: number): AgentLink[] {
        const stmt = this.db.instance.prepare(`
      SELECT * FROM agent_links
      WHERE project_id = ? AND (from_agent_id = ? OR to_agent_id = ?) AND status = 'approved'
    `);

        // We want to show who I can message (where form = me) or who can message me (where to = me)?
        // Usually "my contacts" are people I can msg.
        const rows = stmt.all(projectId, agentId, agentId) as any[];
        return rows.map(this.mapRowToLink);
    }

    private getLink(projectId: number, fromId: number, toId: number): AgentLink | null {
        const stmt = this.db.instance.prepare(`
      SELECT * FROM agent_links
      WHERE project_id = ? AND from_agent_id = ? AND to_agent_id = ?
    `);
        const row = stmt.get(projectId, fromId, toId) as any;
        return row ? this.mapRowToLink(row) : null;
    }

    private mapRowToLink(row: any): AgentLink {
        return {
            id: row.id,
            projectId: row.project_id,
            fromAgentId: row.from_agent_id,
            toAgentId: row.to_agent_id,
            status: row.status,
            reason: row.reason,
            createdAt: row.created_at,
            expiresAt: row.expires_at
        };
    }
}
