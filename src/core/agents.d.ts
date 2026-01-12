import { AgentMailDB } from './database';
export interface Agent {
    id: number;
    projectId: number;
    name: string;
    program: string;
    model: string;
    contactPolicy: 'open' | 'auto' | 'contacts_only';
    createdAt: number;
    lastActiveAt?: number;
}
export interface RegisterAgentParams {
    projectSlug: string;
    name?: string;
    program?: string;
    model?: string;
    contactPolicy?: 'open' | 'auto' | 'contacts_only';
}
export declare class AgentManager {
    private db;
    constructor(db: AgentMailDB);
    private getProjectId;
    register(params: RegisterAgentParams): Agent;
}
//# sourceMappingURL=agents.d.ts.map