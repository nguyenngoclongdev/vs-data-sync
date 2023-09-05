import { Event, LogLevel, LogOutputChannel, ViewColumn, window } from 'vscode';
import { APP_ID } from './constants';

class Logger implements LogOutputChannel {
    private channel: LogOutputChannel;
    public readonly onDidChangeLogLevel: Event<LogLevel>;
    public readonly name: string;

    constructor(channel: LogOutputChannel) {
        this.channel = channel;
        this.name = this.channel.name;
        this.onDidChangeLogLevel = this.channel.onDidChangeLogLevel;
    }

    public get logLevel() {
        return this.channel.logLevel;
    }

    log(message: string, ...args: any[]) {
        this.channel.info(message, ...args);
    }

    trace(message: string, ...args: any[]) {
        this.channel.trace(message, ...args);
    }

    debug(message: string, ...args: any[]) {
        this.channel.debug(message, ...args);
    }

    info(message: string, ...args: any[]) {
        this.channel.info(message, ...args);
    }

    warn(message: string, ...args: any[]) {
        this.channel.warn(message, ...args);
    }

    error(message: string, ...args: any[]) {
        this.channel.error(message, ...args);
    }

    append(value: string): void {
        this.channel.append(value);
    }

    appendLine(value: string): void {
        this.channel.appendLine(value);
    }

    replace(value: string): void {
        this.channel.replace(value);
    }

    clear(): void {
        this.channel.clear();
    }

    show(preserveFocus?: boolean): void;
    show(_?: ViewColumn, preserveFocus?: boolean): void;
    show(_?: boolean | ViewColumn, preserveFocus?: boolean): void {
        this.channel.show(preserveFocus);
    }

    hide(): void {
        this.channel.hide();
    }

    dispose(): void {
        this.channel.dispose();
    }
}

export const logger = new Logger(window.createOutputChannel(APP_ID, { log: true }));
