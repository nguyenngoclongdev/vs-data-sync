import dayjs from 'dayjs';
import path from 'node:path';
import { ProgressLocation, QuickPickItem, commands, window, workspace } from 'vscode';
import { ExtensionConfiguration } from '../extension';
import { ConfigManager } from '../utils/configManager';
import { APP_ID, APP_NAME, extCommands } from '../utils/constants';
import { FileManager, getMigrationRoot } from '../utils/fileManager';
import { logger } from '../utils/logger';
import { showIncorrectConfigWarning, showIsAnalyzingWarning, showNoConfigWarning } from '../utils/notification';
import { showProgressReport, showProgressSuccess, showProgressWarn } from '../utils/progress';
import { store } from '../utils/store';
import { getDatabaseInfo, getMigrationDirs, showErrorMessageWithDetail } from '../utils/utils';
import { generateDiffAsync } from './actions/generateDiffAsync';
import { generateMigrateAsync } from './actions/generateMigrateAsync';
import { generatePlanAsync } from './actions/generatePlanAsync';
import { generateSnapshotAsync } from './actions/generateSnapshotsAsync';
import { tryConnectionAsync } from './actions/tryConnectionAsync';

const genMigrateName = (pattern: string, migrationNameInput: string) => {
    const executeAt = dayjs().format('YYYY-MM-DD');
    return `${executeAt}_${pattern}_${migrationNameInput}`;
};

const showInputMigrateName = async (
    selectedPattern: string,
    migrationRoot: string
): Promise<{ name: string; override?: boolean } | undefined> => {
    // Get migration directories
    const migrationDirs = await getMigrationDirs(migrationRoot);
    const migrationQuickPickItems: QuickPickItem[] = migrationDirs.map((m) => ({
        label: m.name,
        detail: `Overwrites output file to ${m.path}`
    }));

    // Show quick pick to choose the plugin
    const addNewMigration: QuickPickItem = {
        label: 'Add new migration...',
        detail: 'Create new directory, and save output to it.',
        alwaysShow: true
    };
    const quickPickItem = await window.showQuickPick([addNewMigration].concat(migrationQuickPickItems), {
        title: 'Select the migration you want to override or add new migration',
        placeHolder: 'Migration name...',
        ignoreFocusOut: true
    });

    // If not select any item in list => no action
    if (!quickPickItem) {
        return undefined;
    }

    // If select item (not add new) => overwrite existed migration name
    if (quickPickItem.label !== addNewMigration.label) {
        return { name: quickPickItem.label, override: true };
    }

    // If select add new migrate => add new dir and output to this
    const migrationNameInput = await window.showInputBox({
        title: 'Please enter the migration name.',
        placeHolder: 'e.g. migrate-robot-policy, migrate-mfa-permission',
        ignoreFocusOut: true,
        validateInput: (value: string) => {
            if (!value) {
                return 'The migration name cannot be null or empty.';
            }
            if (migrationDirs.some((dir) => dir.name === genMigrateName(selectedPattern, value))) {
                return 'The migration name already exists.';
            }
            return ''; // input valid is OK
        }
    });
    if (!migrationNameInput) {
        return undefined;
    }
    return { name: genMigrateName(selectedPattern, migrationNameInput) };
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
export const analyzeDataAsync = async (selectedPattern: string): Promise<void> => {
    // Check the process is analyzing
    if (store.isAnalyzing) {
        showIsAnalyzingWarning();
        return;
    }
    try {
        // Enable analyzing
        store.isAnalyzing = true;

        // Show input box to enter the session name
        const migrationRoot = getMigrationRoot();
        const migrationInput = await showInputMigrateName(selectedPattern, migrationRoot);
        if (!migrationInput) {
            return;
        }

        // Define migration output dir
        const migrateName = migrationInput.name;
        const migrationOutputDir = path.join(migrationRoot, migrateName);

        // Init file manager
        const fileManager = FileManager.getInstance();
        await fileManager.init({ cwd: migrationOutputDir });

        // Parse configuration
        const configManager = ConfigManager.getInstance();
        await configManager.init({ migrationOutputDir });
        const configContent = configManager.getConfigContent();
        if (!configContent) {
            showNoConfigWarning();
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

        // Processing to generate the snapshot/diff/plan/migrate files
        window.withProgress(
            {
                location: ProgressLocation.Notification,
                title: APP_NAME,
                cancellable: true
            },
            async (progress) => {
                // Check the source database connection config
                showProgressReport(progress, 'Try connecting to the source database...');
                const sourceInfo = getDatabaseInfo(pattern.source);
                const isSourceReady = await tryConnectionAsync(pattern.source);
                if (!isSourceReady) {
                    showProgressWarn(`Failed to connect source database ${sourceInfo}.`);
                    return false;
                }
                showProgressReport(progress, 'Connect to the source database was successfully!');

                // Check the target database connection config
                showProgressReport(progress, 'Try connecting to the target database...');
                const targetInfo = getDatabaseInfo(pattern.target);
                const isTargetReady = await tryConnectionAsync(pattern.target);
                if (!isTargetReady) {
                    showProgressWarn(`Failed to connect target database ${targetInfo}.`);
                    return false;
                }
                showProgressReport(progress, 'Connect to the target database was successfully!');

                // Generate snapshot files (read database and output to file)
                showProgressReport(progress, 'Generating all snapshot files...');
                const isGenerateSnapshotSuccess = await generateSnapshotAsync({
                    fileManager,
                    selectedPattern,
                    pattern
                });
                if (!isGenerateSnapshotSuccess) {
                    showProgressWarn('Failed to generate snapshot files!');
                    return;
                }
                showProgressReport(progress, 'All snapshot files was successfully generated!');

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
        const message = `Failed to analyze data.`;
        logger.error(message, error);
        showErrorMessageWithDetail(message, error);
    } finally {
        store.isAnalyzing = false;
    }
};
