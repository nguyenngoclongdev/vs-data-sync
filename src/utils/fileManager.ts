import path from 'node:path';
import { workspace } from 'vscode';
import { ExtensionConfiguration } from '../extension';
import { APP_ID } from './constants';
import { getWorkspaceFolder } from './utils';

export enum SnapshotType {
    original = 'original',
    modified = 'modified'
}

export type FileManagerPrefix = 'all' | 'insert' | 'update' | 'delete';

export const getMigrationRoot = (): string => {
    const { outputDirPath } = workspace.getConfiguration(APP_ID) as ExtensionConfiguration;
    const defaultOutputDirPath = path.join(getWorkspaceFolder(), 'migrations');
    return outputDirPath || defaultOutputDirPath;
};

export class FileManager {
    private static _instance: FileManager;
    public static getInstance(): FileManager {
        if (!this._instance) {
            this._instance = new FileManager();
        }
        return this._instance;
    }

    private _isInit = false;
    isInit = (): boolean => {
        return this._isInit;
    };
    setInit = (isInit: boolean): void => {
        this._isInit = isInit;
    };

    private _cwd: string = '';
    init = async (options: { cwd: string }): Promise<void> => {
        const { cwd } = options;
        this._cwd = cwd;
        this._isInit = true;
    };

    getSnapshotDir = (): string => {
        return path.join(this._cwd, 'snapshots');
    };

    getOriginalFilePath = (tableName: string): string => {
        const dirPath = path.join(this.getSnapshotDir(), SnapshotType.original);
        return path.join(dirPath, `${tableName}.jsonl`);
    };

    getModifiedFilePath = (tableName: string): string => {
        const dirPath = path.join(this.getSnapshotDir(), SnapshotType.modified);
        return path.join(dirPath, `${tableName}.jsonl`);
    };

    getSnapshotFilePath = (tableName: string, snapshotType: SnapshotType): string => {
        if (snapshotType === SnapshotType.original) {
            return this.getOriginalFilePath(tableName);
        }
        return this.getModifiedFilePath(tableName);
    };

    private getDiffDir = () => {
        return path.join(this._cwd, 'diff');
    };

    getDiffOutputPath = (tableName: string): string => {
        return path.join(this.getDiffDir(), `${tableName}.patch.diff`);
    };

    getStructuredOutputPath = (tableName: string): string => {
        return path.join(this.getDiffDir(), `${tableName}.structured.json`);
    };

    private getPlanOutputDir = (): string => {
        return path.join(this._cwd, `plan`);
    };

    getPlanOutputPath = (prefix: FileManagerPrefix): string => {
        return path.join(this.getPlanOutputDir(), `${prefix}.sql`);
    };

    getSessionPath = (): string => {
        return path.join(this._cwd, `session.json`);
    };

    getMigrateUpPath = (): string => {
        return path.join(this._cwd, `migrate.up.sql`);
    };

    getMigrateDownPath = (): string => {
        return path.join(this._cwd, `migrate.down.sql`);
    };

    getMigrateResultPath = (): string => {
        return path.join(this._cwd, `migrate.result.sql`);
    };
}
