import Database from 'better-sqlite3';
import { SCHEMA } from './schema.js';
import * as path from 'path';
import * as fs from 'fs';

export interface DatabaseConfig {
    path: string;
    verbose?: boolean;
}

export class AgentMailDB {
    private db: Database.Database;

    constructor(config: DatabaseConfig) {
        const dbDir = path.dirname(config.path);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        this.db = new Database(config.path, {
            verbose: config.verbose ? console.log : undefined
        });
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');

        this.init();
    }

    private init() {
        this.db.exec(SCHEMA);
    }

    get instance(): Database.Database {
        return this.db;
    }

    close() {
        this.db.close();
    }
}
