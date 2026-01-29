// src/lib/api/logger.ts

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
    enabled: boolean;
    level: LogLevel;
    prefix: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

class Logger {
    private config: LoggerConfig;

    constructor(config?: Partial<LoggerConfig>) {
        this.config = {
            enabled: process.env.NODE_ENV === 'development',
            level: 'debug',
            prefix: '[API]',
            ...config,
        };
    }

    private shouldLog(level: LogLevel): boolean {
        if (!this.config.enabled) return level === 'error'; // Always log errors
        return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
    }

    private formatMessage(level: LogLevel, ...args: unknown[]): unknown[] {
        const timestamp = new Date().toISOString().slice(11, 23);
        return [`${this.config.prefix} [${timestamp}] [${level.toUpperCase()}]`, ...args];
    }

    debug(...args: unknown[]): void {
        if (this.shouldLog('debug')) {
            console.log(...this.formatMessage('debug', ...args));
        }
    }

    info(...args: unknown[]): void {
        if (this.shouldLog('info')) {
            console.info(...this.formatMessage('info', ...args));
        }
    }

    warn(...args: unknown[]): void {
        if (this.shouldLog('warn')) {
            console.warn(...this.formatMessage('warn', ...args));
        }
    }

    error(...args: unknown[]): void {
        if (this.shouldLog('error')) {
            console.error(...this.formatMessage('error', ...args));
        }
    }

    // Group related logs
    group(label: string): void {
        if (this.config.enabled) {
            console.group(`${this.config.prefix} ${label}`);
        }
    }

    groupEnd(): void {
        if (this.config.enabled) {
            console.groupEnd();
        }
    }

    // Time operations
    time(label: string): void {
        if (this.config.enabled) {
            console.time(`${this.config.prefix} ${label}`);
        }
    }

    timeEnd(label: string): void {
        if (this.config.enabled) {
            console.timeEnd(`${this.config.prefix} ${label}`);
        }
    }
}

// Export singleton instance
export const logger = new Logger();

// Export class for custom instances
export { Logger };