import { AgentMailDB } from './database';
import { AgentManager } from './agents';
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
    senderName?: string;
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
export declare class MessageManager {
    private db;
    private agents;
    constructor(db: AgentMailDB, agents: AgentManager);
    send(params: SendMessageParams): Message;
}
//# sourceMappingURL=messages.d.ts.map