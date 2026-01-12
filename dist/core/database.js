import Database from 'better-sqlite3';
import { SCHEMA } from './schema.js';
import * as path from 'path';
import * as fs from 'fs';
export class AgentMailDB {
    db;
    constructor(config) {
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
    init() {
        this.db.exec(SCHEMA);
    }
    get instance() {
        return this.db;
    }
    close() {
        this.db.close();
    }
}
