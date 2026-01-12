export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    event: string;
    [key: string]: any;
}

export class Logger {
    private static instance: Logger;

    private constructor() { }

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    log(level: LogLevel, event: string, data: Record<string, any> = {}) {
        // We log to stderr so that stdout remains clean for MCP communication
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            event,
            ...data
        };

        console.error(JSON.stringify(entry));
    }

    info(event: string, data?: Record<string, any>) {
        this.log('info', event, data);
    }

    warn(event: string, data?: Record<string, any>) {
        this.log('warn', event, data);
    }

    error(event: string, data?: Record<string, any>) {
        this.log('error', event, data);
    }

    debug(event: string, data?: Record<string, any>) {
        if (process.env.LOG_LEVEL === 'debug') {
            this.log('debug', event, data);
        }
    }
}

export const logger = Logger.getInstance();
