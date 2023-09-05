import fs from 'fs-extra';
import path, { posix } from 'node:path';
import { PoolConfig } from 'pg';
import { Uri, window, workspace } from 'vscode';
import { constants } from './constants';
import { logger } from './logger';

export type TableDetail = {
    primaryKeys: string[];
    columns: string[];
    insert: number;
    update: number;
    delete: number;
};

export type PatternSession = {
    selectedPattern: string;
    migrate?: {
        status?: 'Success' | 'Failed';
        affected?: {
            insert?: number;
            update?: number;
            delete?: number;
        };
    };
    plan: {
        [table: string]: TableDetail;
    };
    system?: {
        [key: string]: string;
    };
};

export type TableConfig = {
    schema?: string;
    name: string;
    excludes?: string[];
    where?: string;
    orderBy?: string;

    // Optional
    columns?: string[];
    primaryKeys?: string[];
};

export type RowAffectedAction = 'ignore' | 'log' | 'warn' | 'throw';
export type MigrateConfig = {
    noInsert?: boolean;
    noUpdate?: boolean;
    noDelete?: boolean;
    noRowAffected?: RowAffectedAction;
    multipleRowAffected?: RowAffectedAction;
};

export type PatternConfig = {
    source: PoolConfig;
    target: PoolConfig;
    diff: {
        format?: boolean;
        tables: TableConfig[];
    };
    plan?: any;
    migrate?: MigrateConfig;
};

export type DataSyncConfig = {
    $schema: string;
    verbose?: boolean;
    patterns: {
        [key: string]: PatternConfig;
    };
};

export const getWorkspaceFolder = (): string => {
    return workspace.workspaceFolders?.[0].uri.fsPath || '';
};

export const getVscodeFolder = (): string => {
    const workspacePath = getWorkspaceFolder();
    return posix.join(workspacePath, '.vscode');
};

export const getTabWidth = (): number => {
    let tabWidth = 0;

    const editorTabWidth = workspace.getConfiguration().get('editor.tabSize');
    if (!Number.isNaN(editorTabWidth)) {
        tabWidth = Number(editorTabWidth);
    }

    let prettierTabWidth = workspace.getConfiguration().get('prettier.tabWidth');
    if (!Number.isNaN(prettierTabWidth)) {
        tabWidth = Number(prettierTabWidth);
    }

    const defaultTabWidth = 4;
    return tabWidth > 0 ? tabWidth : defaultTabWidth;
};

export const showErrorMessageWithDetail = (message: string, error: unknown): void => {
    const detailError = error instanceof Error ? (error as Error)?.message : `${error}`;
    window.showErrorMessage(message, constants.more).then((selection) => {
        if (selection === constants.more) {
            window.showErrorMessage(detailError, { modal: true });
        }
    });
};

export const delay = async (milliseconds: number): Promise<void> => {
    return await new Promise((resolve) => setTimeout(resolve, milliseconds));
};

export const showTextDocument = (filePath: string): void => {
    const existingDoc = workspace.textDocuments.find((doc) => doc.uri.fsPath === filePath);
    if (existingDoc) {
        const visibleEditor = window.visibleTextEditors.find((editor) => editor.document === existingDoc);
        if (visibleEditor) {
            window.showTextDocument(visibleEditor.document, visibleEditor.viewColumn, false);
        } else {
            window.showTextDocument(existingDoc, { preserveFocus: false });
        }
    } else {
        const stepDefinitionFileUri = Uri.file(filePath);
        window.showTextDocument(stepDefinitionFileUri, { preserveFocus: false });
    }
};

export const upperToPascal = (input: string): string => {
    const words = input.toLowerCase().split('_');
    const capitalizedWords = words.map((word) => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    });
    return capitalizedWords.join('');
};

export const getDatabaseInfo = (poolConfig: PoolConfig): string => {
    const { user, host, port, database } = poolConfig;
    const maskPassword = '*'.repeat(6);
    return `postgres://${user}:${maskPassword}@${host}:${port}/${database}`;
};

export const getTablePrimaryKey = (table: TableConfig, tableDetail: TableDetail, record: any): string => {
    const tablePrimaryKey = tableDetail.primaryKeys?.map((primaryKey) => record[primaryKey]).join('_');
    if (!tablePrimaryKey) {
        const errorMessage = `The table '${table.name}' not exist any primary keys!`;
        logger.error(errorMessage, tableDetail.primaryKeys);
        const error = new Error(errorMessage);
        error.stack = JSON.stringify(tableDetail.primaryKeys, null, 2);
        throw error;
    }
    return tablePrimaryKey;
};

export const getMigrationDirs = async (migrationRoot: string): Promise<{ name: string; path: string }[]> => {
    const migrationDirs = [];
    const isExistRoot = await fs.exists(migrationRoot);
    if (isExistRoot) {
        const fileOrDirNames = await fs.readdir(migrationRoot);
        for (let i = 0; i < fileOrDirNames.length; i++) {
            const fileOrDirName = fileOrDirNames[i];
            const fileOrDirPath = path.join(migrationRoot, fileOrDirName);
            const stat = await fs.stat(fileOrDirPath);
            if (stat.isDirectory()) {
                migrationDirs.push({
                    name: fileOrDirName,
                    path: fileOrDirPath
                });
            }
        }
    }
    return migrationDirs.reverse();
};

export const showInputPassword = async (
    from: 'source' | 'target',
    poolConfig: PoolConfig
): Promise<string | undefined> => {
    const passwordInput = await window.showInputBox({
        title: `Please enter a password to use with ${from} database.`,
        prompt: `${from.toUpperCase()}: ${getDatabaseInfo(poolConfig)}`,
        password: true,
        ignoreFocusOut: true
    });
    if (passwordInput === undefined) {
        return undefined;
    }
    return passwordInput;
};
