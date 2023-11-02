import dayjs from 'dayjs';
import fs from 'fs-extra';
import { EOL, arch, networkInterfaces, userInfo } from 'node:os';
import pg, { PoolConfig } from 'pg';
import { ProgressLocation, QuickPickItem, window, workspace } from 'vscode';
import { ExtensionConfiguration } from '../extension';
import { ConfigManager } from '../utils/configManager';
import { APP_ID, APP_NAME, constants } from '../utils/constants';
import { FileManager } from '../utils/fileManager';
import { logger } from '../utils/logger';
import { showIsAnalyzingWarning, showNoConfigWarning, showNoPatternWarning } from '../utils/notification';
import { showProgressReport, showProgressSuccess, showProgressWarn } from '../utils/progress';
import { isDeleteQuery, isInsertQuery, isUpdateQuery } from '../utils/query';
import { store } from '../utils/store';
import {
    MigrateConfig,
    PatternSession,
    RowAffectedAction,
    getDatabaseInfo,
    getTabWidth,
    showErrorMessageWithDetail,
    showInputPassword
} from '../utils/utils';
import { tryConnectionAsync } from './actions/tryConnectionAsync';

const handleWarningQueries = (
    warnQueries: { rawQuery: string; affected: number }[],
    warnQueryConfig: RowAffectedAction,
    message: string
) => {
    const rawQueries = warnQueries.map((q) => `${EOL}- ${q.rawQuery}`).join('');
    const logMessage = message.concat(rawQueries);
    switch (warnQueryConfig) {
        case 'ignore':
            break;
        case 'log':
            logger.info(logMessage);
            break;
        case 'warn':
            logger.warn(logMessage);
            break;
        case 'throw':
            logger.error(logMessage);
            const error = new Error(logMessage);
            error.stack = rawQueries;
            throw error;
    }
};

export const executeMigrate = async (options: {
    poolConfig: PoolConfig;
    migrateConfig?: MigrateConfig;
    migrateUpLines: string[];
}): Promise<{ insert: number; update: number; delete: number; error?: unknown }> => {
    const { poolConfig, migrateConfig, migrateUpLines } = options;
    let pool: pg.Pool | undefined = undefined;
    let client: pg.PoolClient | undefined = undefined;
    let rowAffected = {
        insert: 0,
        update: 0,
        delete: 0
    };
    try {
        // Connect to database
        pool = new pg.Pool(poolConfig);
        client = await pool.connect();

        // Start transaction
        await client.query('BEGIN');

        // Start insert/update
        const noAffectedQueries: { rawQuery: string; affected: number }[] = [];
        const multiAffectedQueries: { rawQuery: string; affected: number }[] = [];
        for (let i = 0; i < migrateUpLines.length; i++) {
            const rawQuery = migrateUpLines[i].trim();
            const isInsert = isInsertQuery(rawQuery);
            const isUpdate = isUpdateQuery(rawQuery);
            const isDelete = isDeleteQuery(rawQuery);

            // Ignore if line is empty/comment
            const isBlankLine = rawQuery === '';
            const isCommentLine = rawQuery.startsWith('--');
            if (isBlankLine || isCommentLine) {
                continue;
            }

            // Run query
            logger.info(`Execute '${rawQuery}' to migrate...`);
            const { rowCount } = await client.query(rawQuery);

            // Count affected
            if (isInsert) {
                rowAffected.insert++;
            }
            if (isUpdate) {
                rowAffected.update++;
            }
            if (isDelete) {
                rowAffected.delete++;
            }

            // Throw error if not migrate to any rows
            if (rowCount <= 0) {
                noAffectedQueries.push({ rawQuery, affected: rowCount });
            }

            // Push to lines
            if (rowCount >= 2) {
                multiAffectedQueries.push({ rawQuery, affected: rowCount });
            }

            // Print migrate success
            logger.info(`The '${rawQuery}' was successful migrated!`);
        }

        // Validate no affected record before commit to database
        if (noAffectedQueries.length > 0) {
            const message = `The query was no affected to database:`;
            handleWarningQueries(noAffectedQueries, migrateConfig?.noRowAffected || 'throw', message);
        }

        // Validate multi affected record before commit to database
        if (multiAffectedQueries.length > 0) {
            const message = `The query was multiple affected to database:`;
            handleWarningQueries(noAffectedQueries, migrateConfig?.multipleRowAffected || 'throw', message);
        }

        // Commit transaction
        await client.query('COMMIT');
        return rowAffected;
    } catch (error) {
        if (client) {
            logger.error(`Failed to migrate data. Starting rollback data...`, error);
            await client.query('ROLLBACK');
            logger.info(`The data was successful rollback!`);
        }
        return { ...rowAffected, error };
    } finally {
        if (client) {
            client.release();
        }
    }
};

const getSystemInfo = (): { [key: string]: string } => {
    const { eno1 } = networkInterfaces();
    const localIp = eno1?.[0].address;
    const executedAt = dayjs().format('YYYY-MM-DD HH:MM:ss');
    return {
        cpu: arch(),
        ip: localIp || '',
        executedBy: userInfo().username,
        executedAt: executedAt
    };
};

/**
 * Migrate all changes to target database
 * - migrations/<migrate-name>/session.json
 */
export const migrateDataAsync = async (migrateFilePath: string): Promise<void> => {
    try {
        // Check the process is analyzing
        if (store.isAnalyzing) {
            showIsAnalyzingWarning();
            return;
        }

        // Parse configuration
        const configManager = ConfigManager.getInstance();
        const configContent = configManager.getConfigContent();
        if (!configManager.isInit() || !configContent) {
            showNoConfigWarning();
            return;
        }

        // Init file manager
        const fileManager = FileManager.getInstance();
        if (!fileManager.isInit()) {
            showNoPatternWarning();
            return;
        }

        // Init configuration
        const pattern = configContent.patterns[store.currentPattern];

        // Get plan content
        logger.info(`Starting migrate file '${migrateFilePath}'`);
        const migrateUpContent = await fs.readFile(migrateFilePath, 'utf-8');
        if (!migrateUpContent) {
            window.showWarningMessage(`The migrate file ${migrateFilePath} is empty.`);
            return;
        }

        // Split plan content by break lines
        const migrateUpLines = migrateUpContent.split(EOL);
        if (migrateUpLines.length <= 0) {
            window.showWarningMessage(`The migrate file ${migrateFilePath} is not exist any line.`);
            return;
        }

        // Show question to confirm run migrate
        const quickPickItems = [constants.yes, constants.no].map((key): QuickPickItem => ({ label: key }));
        const quickPickItem = await window.showQuickPick(quickPickItems, {
            title: `Would you like to migrate the data changes?`,
            placeHolder: 'Choose `Yes` if you want to migrate...'
        });
        if (!quickPickItem || quickPickItem.label === constants.no) {
            return;
        }

        // Show output panel
        const config = workspace.getConfiguration(APP_ID) as ExtensionConfiguration;
        if (config.showOutputPanel) {
            logger.show();
        }

        // Restore password from store to config
        if (store.targetPassword !== undefined) {
            pattern.target.password = store.targetPassword;
        }

        // Show password input if not defined
        if (pattern.target.password === undefined) {
            const inputPassword = await showInputPassword('target', pattern.target);
            if (typeof inputPassword === 'undefined') {
                return;
            }
            pattern.target.password = inputPassword;
        }

        // Processing migrate data
        window.withProgress(
            {
                location: ProgressLocation.Notification,
                title: APP_NAME,
                cancellable: true
            },
            async (progress): Promise<boolean> => {
                // Check the source database connection config
                if (config.checkDatabaseConnection) {
                    showProgressReport(progress, 'Try connecting to the source database...');
                    const sourceInfo = getDatabaseInfo(pattern.source);
                    const isSourceReady = await tryConnectionAsync(pattern.source);
                    if (!isSourceReady) {
                        showProgressWarn(`Failed to connect source database ${sourceInfo}.`);
                        return false;
                    }
                    showProgressReport(progress, 'Connect to the source database was successfully!');
                }

                // Check the target database connection config
                if (config.checkDatabaseConnection) {
                    showProgressReport(progress, 'Try connecting to the target database...');
                    const targetInfo = getDatabaseInfo(pattern.target);
                    const isTargetReady = await tryConnectionAsync(pattern.target);
                    if (!isTargetReady) {
                        showProgressWarn(`Failed to connect target database ${targetInfo}.`);
                        return false;
                    }
                    showProgressReport(progress, 'Connect to the target database was successfully!');
                }

                // Execute migrate
                showProgressReport(progress, `Starting migrate data...`);
                logger.info(`Migrate to target with db connection '${getDatabaseInfo(pattern.target)}'....`);
                const rowAffected = await executeMigrate({
                    migrateUpLines,
                    migrateConfig: pattern.migrate,
                    poolConfig: pattern.target
                });
                if (rowAffected.error) {
                    showErrorMessageWithDetail(
                        `Failed to migrate data. The data will be rollback successful!`,
                        rowAffected.error
                    );
                    return false;
                }
                showProgressReport(
                    progress,
                    `The data was successfully migrated with ${
                        rowAffected.insert + rowAffected.update + rowAffected.delete
                    } row(s) affected!`,
                    { noLog: true }
                );

                // Write session info to file
                showProgressReport(progress, `Saving migrate information...`);
                const sessionPath = fileManager.getSessionPath();
                const session: PatternSession = await fs.readJson(sessionPath);
                session.selectedPattern = store.currentPattern;
                session.system = getSystemInfo();
                session.migrate = {
                    status: 'Success',
                    affected: rowAffected
                };
                await fs.writeJson(sessionPath, session, { spaces: getTabWidth() });
                showProgressReport(progress, `The migrate information was successfully saved!`);

                // Show message
                showProgressSuccess(`The data has been migrated successfully.`);
                logger.info(`- Insert: ${rowAffected.insert} row(s) affected`);
                logger.info(`- Update: ${rowAffected.update} row(s) affected`);
                logger.info(`- Delete: ${rowAffected.delete} row(s) affected`);

                // Return a value when the task completes
                return true;
            }
        );
    } catch (error) {
        const message = `Failed to migrate data!`;
        logger.error(message, error);
        showErrorMessageWithDetail(message, error);
    }
};
