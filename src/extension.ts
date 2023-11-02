import { basename } from 'node:path';
import { ExtensionContext, Uri, WorkspaceConfiguration, commands, window } from 'vscode';
import { analyzeDataAsync } from './commands/analyzeDataAsync';
import { analyzeDataOnImportAsync } from './commands/analyzeDataOnImportAsync';
import { generateConfigAsync } from './commands/generateConfigAsync';
import { migrateDataAsync } from './commands/migrateDataAsync';
import { showConfigAsync } from './commands/showConfigAsync';
import { CompareProvider, CompareTreeItem } from './explorer/compare-provider';
import { InfoProvider, InfoTreeItem } from './explorer/info-provider';
import { MigrateProvider, MigrateTreeItem } from './explorer/migrate-provider';
import { APP_ID, extCommands } from './utils/constants';
import { FileManager } from './utils/fileManager';
import { logger } from './utils/logger';
import { store } from './utils/store';
import { showTextDocument } from './utils/utils';

export interface ExtensionConfiguration extends WorkspaceConfiguration {
    configFilePath?: string;
    outputDirPath?: string;
    showOutputPanel?: boolean;
    checkDatabaseConnection?: boolean;
}

export async function activate(context: ExtensionContext) {
    // Print welcome message
    logger.info('Starting Data Sync extensions.');

    // Global command
    context.subscriptions.push(
        commands.registerCommand(extCommands.showConfiguration, async () => {
            await showConfigAsync();
        }),
        commands.registerCommand(extCommands.generateConfiguration, async (overwriteConfiguration: boolean = false) => {
            await generateConfigAsync(overwriteConfiguration);
        })
    );

    // Init info provider
    const infoProvider = new InfoProvider();
    window.registerTreeDataProvider('data-sync-info', infoProvider);
    context.subscriptions.push(
        commands.registerCommand(extCommands.refreshInfoView, async () => {
            logger.info(`Click on refresh the info activity`);
            infoProvider.refresh();
        }),
        commands.registerCommand(extCommands.processInfo, async () => logger.show(true)),
        commands.registerCommand(extCommands.importAnalyzeData, async () => {
            await analyzeDataOnImportAsync();
        }),
        commands.registerCommand(extCommands.analyzeData, async (treeItem: InfoTreeItem) => {
            logger.info(`Click on info tree item '${treeItem.patternName}'`);
            await analyzeDataAsync(treeItem.patternName || '');
        })
    );

    // Init compare provider
    const compareProvider = new CompareProvider();
    window.registerTreeDataProvider('data-sync-compare', compareProvider);
    context.subscriptions.push(
        commands.registerCommand(extCommands.refreshCompareView, async (value?: any) => {
            const isSkipReanalyze: boolean = typeof value === 'boolean' ? value : false;
            logger.info(`Click on refresh the compare activity`, {
                skipReanalyze: isSkipReanalyze,
                currentPattern: store.currentPattern,
                migrateName: store.migrateName
            });
            await compareProvider.refresh(isSkipReanalyze);
        }),
        commands.registerCommand(extCommands.openOriginalFile, (treeItem: CompareTreeItem) => {
            logger.info(`Click on compare tree item '${treeItem.tableName}'`);
            const fileManager = FileManager.getInstance();
            const tableName = treeItem.tableName || '';
            if (fileManager.isInit() && tableName) {
                const originalFilePath = fileManager.getOriginalFilePath(tableName);
                showTextDocument(originalFilePath);
            }
        }),
        commands.registerCommand(extCommands.openModifiedFile, (treeItem: CompareTreeItem) => {
            logger.info(`Click on compare tree item '${treeItem.tableName}'`);
            const fileManager = FileManager.getInstance();
            const tableName = treeItem.tableName || '';
            if (fileManager.isInit() && tableName) {
                const modifiedFilePath = fileManager.getModifiedFilePath(tableName);
                showTextDocument(modifiedFilePath);
            }
        }),
        commands.registerCommand(extCommands.inlineDiff, (treeItem: CompareTreeItem) => {
            logger.info(`Click on compare tree item '${treeItem.tableName}'`);
            const fileManager = FileManager.getInstance();
            const tableName = treeItem.tableName || '';
            if (fileManager.isInit() && tableName) {
                const diffFilePath = fileManager.getDiffOutputPath(tableName);
                showTextDocument(diffFilePath);
            }
        }),
        commands.registerCommand(extCommands.sideBySideDiff, async (treeItem: CompareTreeItem) => {
            logger.info(`Click on compare tree item '${treeItem.tableName}'`);
            const fileManager = FileManager.getInstance();
            const tableName = treeItem.tableName || '';
            if (fileManager.isInit() && tableName) {
                const originalFilePath = fileManager.getOriginalFilePath(tableName);
                const modifiedFilePath = fileManager.getModifiedFilePath(tableName);
                const diffTitle = `Original • ${basename(originalFilePath)} ↔ Modified • ${basename(modifiedFilePath)}`;
                await commands.executeCommand(
                    'vscode.diff',
                    Uri.file(originalFilePath),
                    Uri.file(modifiedFilePath),
                    diffTitle,
                    {
                        preview: true
                    }
                );
            }
        })
    );

    // Init migrate provider
    const migrateProvider = new MigrateProvider();
    window.registerTreeDataProvider('data-sync-migrate', migrateProvider);
    context.subscriptions.push(
        commands.registerCommand(extCommands.refreshMigrateView, async (value?: any) => {
            const isSkipReanalyze: boolean = typeof value === 'boolean' ? value : false;
            logger.info(`Click on refresh the diff activity`, {
                skipReanalyze: isSkipReanalyze,
                currentPattern: store.currentPattern,
                migrateName: store.migrateName
            });
            await migrateProvider.refresh(isSkipReanalyze);
        }),
        commands.registerCommand(extCommands.viewMigratePlan, async (treeItem: MigrateTreeItem) => {
            logger.info(`Click on migrate tree item '${treeItem.fileName}'`);
            if (treeItem.filePath) {
                showTextDocument(treeItem.filePath);
            }
        }),
        commands.registerCommand(extCommands.executeMigrate, async (treeItem: MigrateTreeItem) => {
            logger.info(`Click on migrate tree item '${treeItem.fileName}'`);
            if (treeItem.filePath) {
                await migrateDataAsync(treeItem.filePath);
            }
        })
    );
}

export async function deactivate() {
    window.showInformationMessage(`[${APP_ID}] Goodbye.`);
}
