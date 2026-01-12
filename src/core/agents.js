"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentManager = void 0;
const database_1 = require("./database");
class AgentManager {
    db;
    constructor(db) {
        this.db = db;
    }
    getProjectId(slug) {
        const stmt = this.db.instance.prepare('SELECT id FROM projects WHERE slug = ?');
        const row = stmt.get(slug);
        if (row)
            return row.id;
        // Create project if not exists (auto-provisioning for now)
        const insert = this.db.instance.prepare('INSERT INTO projects (slug) VALUES (?)');
        const info = insert.run(slug);
        return info.lastInsertRowid;
    }
    register(params) {
        const projectId = this.getProjectId(params.projectSlug);
        const name = params.name || this.generateName();
        const insert = this.db.instance.prepare(`
      INSERT INTO agents (project_id, name, program, model, contact_policy, last_active_at)
      VALUES (@projectId, @name, @program, @model, @contactPolicy, strftime('%s', 'now'))
      ON CONFLICT(project_id, name) DO UPDATE SET
        program = COALESCE(@program, program),
        model = COALESCE(@model, model),
        contact_policy = COALESCE(@contactPolicy, contact_policy),
        last_active_at = strftime('%s', 'now')
      RETURNING *
    \`);

    const row = insert.get({
      projectId,
      name,
      program: params.program || null,
      model: params.model || null,
      contactPolicy: params.contactPolicy || 'auto'
    }) as any;

    return this.mapRowToAgent(row);
  }

  whois(projectSlug: string, name: string): Agent | null {
    const projectId = this.getProjectId(projectSlug);
    const stmt = this.db.instance.prepare('SELECT * FROM agents WHERE project_id = ? AND name = ?');
    const row = stmt.get(projectId, name) as any;
    return row ? this.mapRowToAgent(row) : null;
  }

  list(projectSlug: string): Agent[] {
    const projectId = this.getProjectId(projectSlug);
    const stmt = this.db.instance.prepare('SELECT * FROM agents WHERE project_id = ? ORDER BY last_active_at DESC');
    const rows = stmt.all(projectId) as any[];
    return rows.map(this.mapRowToAgent);
  }

  private generateName(): string {
    const adjectives = ['Green', 'Blue', 'Red', 'Swift', 'Bright', 'Silent', 'Wise', 'Bold'];
    const nouns = ['Mountain', 'Lake', 'Forest', 'River', 'Sky', 'Storm', 'Owl', 'Eagle'];
    return \`\${adjectives[Math.floor(Math.random() * adjectives.length)]}\${nouns[Math.floor(Math.random() * nouns.length)]}\`;
  }

  private mapRowToAgent(row: any): Agent {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      program: row.program,
      model: row.model,
      contactPolicy: row.contact_policy,
      createdAt: row.created_at,
      lastActiveAt: row.last_active_at
    };
  }
}
        );
    }
}
exports.AgentManager = AgentManager;
//# sourceMappingURL=agents.js.map