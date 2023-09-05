import fs from 'fs-extra';
import path from 'node:path';
import { ProgressLocation, QuickPickItem, commands, window, workspace } from 'vscode';
import { ExtensionConfiguration } from '../extension';
import { ConfigManager } from '../utils/configManager';
import { APP_ID, APP_NAME, extCommands } from '../utils/constants';
import { FileManager, getMigrationRoot } from '../utils/fileManager';
import { logger } from '../utils/logger';
import {
    showIsAnalyzingWarning as showAnalyzingWarning,
    showIncorrectConfigWarning,
    showNoConfigWarning
} from '../utils/notification';
import { showProgressReport, showProgressSuccess, showProgressWarn } from '../utils/progress';
import { store } from '../utils/store';
import { PatternSession, getMigrationDirs, showErrorMessageWithDetail } from '../utils/utils';
import { generateDiffAsync } from './actions/generateDiffAsync';
import { generateMigrateAsync } from './actions/generateMigrateAsync';
import { generatePlanAsync } from './actions/generatePlanAsync';

const showInputMigrateName = async (
    migrationRoot: string
): Promise<{ name: string; override?: boolean } | undefined> => {
    // Get migration directories
    const migrationDirs = await getMigrationDirs(migrationRoot);
    const migrationQuickPickItems: QuickPickItem[] = migrationDirs.map((m) => ({
        label: m.name,
        detail: m.path
    }));

    // Show quick pick to choose the plugin
    const closeImportMode: QuickPickItem = {
        label: 'Close Import Mode',
        detail: 'Close Import Mode and using the latest configuration.',
        alwaysShow: true
    };
    const quickPickItem = await window.showQuickPick([...migrationQuickPickItems, closeImportMode], {
        title: 'Select the migration you want to import',
        placeHolder: 'Migration name...',
        ignoreFocusOut: true
    });

    // If not select any item in list => no action
    if (!quickPickItem) {
        return undefined;
    }
    return { name: quickPickItem.label };
};

/**
 * Generate all prepare files
 * 1. Generate snapshot files
 * - migrations/<migrate-name>/snapshots/original
 * - migrations/<migrate-name>/snapshots/modified
 * 2. Generate diff files
 * - migrations/<migrate-name>/diff/*.patch.diff
 * - migrations/<migrate-name>/diff/*.structured.diff
 * 3. Generate plan files
 * - migrations/<migrate-name>/plan/all.sql
 * - migrations/<migrate-name>/plan/insert.sql
 * - migrations/<migrate-name>/plan/update.sql
 * - migrations/<migrate-name>/plan/delete.sql
 * 4. Generate migrate files
 * - migrations/<migrate-name>/migrate.up.sql
 * - migrations/<migrate-name>/migrate.down.sql
 * 5. Migrate information
 * - migrations/<migrate-name>/session.json
 */
export const analyzeDataOnImportAsync = async (): Promise<void> => {
    try {
        // Check the process is analyzing
        if (store.isAnalyzing) {
            showAnalyzingWarning();
            return;
        }

        // Enable analyzing
        store.isAnalyzing = true;
        store.isImportSession = true;

        // Show input box to enter
        const migrationRoot = getMigrationRoot();
        const migrationInput = await showInputMigrateName(migrationRoot);
        if (!migrationInput) {
            return;
        }
        if (migrationInput.name === 'Close Import Mode') {
            // Reset init file manager
            await FileManager.getInstance().init({ cwd: '' });
            await FileManager.getInstance().setInit(false);

            // Reset init file config
            await ConfigManager.getInstance().init({ migrationOutputDir: '', isImportAnalyzeData: false });
            await ConfigManager.getInstance().setInit(false);

            // Clear memory store
            store.isAnalyzing = false;
            store.isImportSession = false;
            store.currentPattern = '';
            store.sourcePassword = undefined;
            store.targetPassword = undefined;

            // Refresh all activity
            await commands.executeCommand(extCommands.refreshInfoView);
            await commands.executeCommand(extCommands.refreshCompareView, true); // skip regeneration
            await commands.executeCommand(extCommands.refreshMigrateView, true); // skip regeneration
            return;
        }

        // Generate migrate name
        const migrateName = migrationInput.name;

        // Init file manager
        const migrationOutputDir = path.join(migrationRoot, migrateName);
        const fileManager = FileManager.getInstance();
        await fileManager.init({ cwd: migrationOutputDir });

        // Parse configuration
        const configManager = ConfigManager.getInstance();
        await configManager.init({ migrationOutputDir, isImportAnalyzeData: true });
        const configContent = configManager.getConfigContent();
        if (!configManager.isInit() || !configContent) {
            showNoConfigWarning();
            return;
        }

        // Get import session
        const sessionPath = fileManager.getSessionPath();
        const session: PatternSession = await fs.readJson(sessionPath);
        const selectedPattern = session.selectedPattern;
        if (!selectedPattern) {
            window.showWarningMessage('Not found the previous pattern.');
            return;
        }

        // Init configuration
        const { patterns, verbose } = configContent;
        const pattern = patterns[selectedPattern];
        const tables = pattern?.diff?.tables;
        if (!tables || tables.length <= 0) {
            showIncorrectConfigWarning(selectedPattern);
            return;
        }

        // Show output panel
        const config = workspace.getConfiguration(APP_ID) as ExtensionConfiguration;
        if (config.showOutputPanel) {
            logger.show();
        }

        // Processing to generate the diff/plan/migrate files
        window.withProgress(
            {
                location: ProgressLocation.Notification,
                title: APP_NAME,
                cancellable: true
            },
            async (progress) => {
                // Generate diff files (compare two files and generate changes)
                showProgressReport(progress, 'Generating diff files...');
                const isGenerateDiffSuccess = await generateDiffAsync({ fileManager, tables });
                if (!isGenerateDiffSuccess) {
                    showProgressWarn('Failed to generate diff files!');
                    return;
                }
                showProgressReport(progress, 'The diff files was successfully generated!');

                // Generate plan files (from diff files, generate to plan)
                showProgressReport(progress, 'Generating plan files...');
                const isGeneratePlanSuccess = await generatePlanAsync({ fileManager, tables });
                if (!isGeneratePlanSuccess) {
                    showProgressWarn('Failed to generate plan files!');
                    return;
                }
                showProgressReport(progress, 'The plan files was successfully generated!');

                // Generate migrate files (from plan files, generate to migrate files)
                showProgressReport(progress, 'Generating migrate files...');
                const isGenerateMigrateSuccess = await generateMigrateAsync({ fileManager, verbose, pattern });
                if (!isGenerateMigrateSuccess) {
                    showProgressWarn('Failed to generate migrate files!');
                    return;
                }
                showProgressReport(progress, 'The migrate files was successfully generated!');

                // Enable flag
                store.currentPattern = selectedPattern;
                store.migrateName = migrateName;

                // Saved password to store from config
                store.sourcePassword =
                    pattern?.source?.password === undefined ? undefined : pattern.source.password.toString();
                store.targetPassword =
                    pattern?.target?.password === undefined ? undefined : pattern.target.password.toString();

                // Refresh activity
                await commands.executeCommand(extCommands.refreshInfoView);
                await commands.executeCommand(extCommands.refreshCompareView, true); // skip regeneration
                await commands.executeCommand(extCommands.refreshMigrateView, true); // skip regeneration

                // Show message
                showProgressSuccess(`The data has been analyzed successfully.`);

                // Return a value when the task completes
                return 'Task completed!';
            }
        );
    } catch (error) {
        const message = `Failed to analyze data!`;
        logger.error(message, error);
        showErrorMessageWithDetail(message, error);
    } finally {
        store.isAnalyzing = false;
    }
};
