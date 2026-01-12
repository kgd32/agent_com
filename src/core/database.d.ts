import Database from 'better-sqlite3';
export interface DatabaseConfig {
    path: string;
    verbose?: boolean;
}
export declare class AgentMailDB {
    private db;
    constructor(config: DatabaseConfig);
    private init;
    get instance(): Database.Database;
    close(): void;
}
//# sourceMappingURL=database.d.ts.map