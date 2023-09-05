import { ProgressLocation, commands, window, workspace } from 'vscode';
import { ExtensionConfiguration } from '../extension';
import { ConfigManager } from '../utils/configManager';
import { APP_ID, APP_NAME, extCommands } from '../utils/constants';
import { FileManager } from '../utils/fileManager';
import { logger } from '../utils/logger';
import { showIncorrectConfigWarning, showNoConfigWarning, showNoPatternWarning } from '../utils/notification';
import { showProgressReport, showProgressWarn } from '../utils/progress';
import { showErrorMessageWithDetail } from '../utils/utils';
import { generateDiffAsync } from './actions/generateDiffAsync';
import { generateMigrateAsync } from './actions/generateMigrateAsync';
import { generatePlanAsync } from './actions/generatePlanAsync';

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
export const analyzeDataOnRefreshAsync = async (selectedPattern: string, migrateName: string): Promise<void> => {
    try {
        // Parse configuration
        const configManager = ConfigManager.getInstance();
        const configContent = configManager.getConfigContent();
        if (!configManager.isInit() || !configContent) {
            showNoConfigWarning();
            return;
        }

        // Init configuration
        const { patterns, verbose } = configContent;
        const pattern = patterns[selectedPattern];
        const tables = pattern?.diff?.tables;
        if (!tables || tables.length <= 0) {
            showIncorrectConfigWarning();
            return;
        }

        // Init file manager
        const fileManager = FileManager.getInstance();
        if (!fileManager.isInit()) {
            showNoPatternWarning();
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

                // Refresh activity
                await commands.executeCommand(extCommands.refreshCompareView, true); // skip regeneration
                await commands.executeCommand(extCommands.refreshMigrateView, true); // skip regeneration

                // Return a value when the task completes
                return 'Task completed!';
            }
        );
    } catch (error) {
        const message = `Failed to analyze data!`;
        logger.error(message, error);
        showErrorMessageWithDetail(message, error);
    }
};
