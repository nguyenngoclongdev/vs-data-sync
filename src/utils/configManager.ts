import fs from 'fs-extra';
import path, { posix } from 'path';
import { workspace } from 'vscode';
import { ExtensionConfiguration } from '../extension';
import { APP_ID } from './constants';
import { DataSyncConfig, getVscodeFolder } from './utils';

export type ConfigInitOption = {
    migrationOutputDir: string;
    isImportAnalyzeData?: boolean;
};

export class ConfigManager {
    private static _instance: ConfigManager;
    private static _configFileName: string = 'database.json';
    private _configFilePath: string | undefined;
    private _configContent: DataSyncConfig | undefined;

    public static getInstance(): ConfigManager {
        if (!this._instance) {
            this._instance = new ConfigManager();
        }
        return this._instance;
    }

    getDefaultConfigFilePath = (): string => {
        const { configFilePath } = workspace.getConfiguration(APP_ID) as ExtensionConfiguration;
        if (configFilePath) {
            return configFilePath;
        }

        // Return default config path
        const vscodePath = getVscodeFolder();
        return posix.join(vscodePath, ConfigManager._configFileName);
    };

    private _isInit = false;
    isInit = (): boolean => {
        return this._isInit;
    };
    setInit = (isInit: boolean): void => {
        this._isInit = isInit;
    };

    init = async (options: ConfigInitOption): Promise<void> => {
        const { isImportAnalyzeData, migrationOutputDir } = options;

        const outputConfigFilePath = path.join(migrationOutputDir, ConfigManager._configFileName);
        if (!isImportAnalyzeData) {
            // Create new analyze session, copy config file to output dir
            const defaultConfigFilePath = this.getDefaultConfigFilePath();
            if (await fs.exists(defaultConfigFilePath)) {
                await fs.ensureFile(outputConfigFilePath);
                await fs.copy(this.getDefaultConfigFilePath(), outputConfigFilePath);
            }
        }
        this._configFilePath = outputConfigFilePath;

        // Read config content
        this._configContent = await fs.readJSON(this._configFilePath);

        // Flag to mark init completely
        this._isInit = true;
    };

    getConfigFilePath = () => {
        return this._configFilePath;
    };

    getConfigContent = () => {
        return this._configContent;
    };
}
