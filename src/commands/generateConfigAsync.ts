/* eslint-disable @typescript-eslint/naming-convention */
import fs from 'fs-extra';
import { EOL } from 'node:os';
import { commands, window } from 'vscode';
import { configTemplate } from '../templates/configuration';
import { ConfigManager } from '../utils/configManager';
import { APP_NAME, constants, extCommands } from '../utils/constants';
import { logger } from '../utils/logger';
import { getTabWidth, showErrorMessageWithDetail, showTextDocument } from '../utils/utils';

/**
 * Generate the config from template to default dir or specify dir by user
 * - .vscode/database.json
 */
export const generateConfigAsync = async (overwriteConfig?: boolean): Promise<void> => {
    try {
        // If config file is existed, confirm want to overwrite this file
        const configFilePath = ConfigManager.getInstance().getDefaultConfigFilePath();
        const isConfigFileExist = await fs.exists(configFilePath);
        if (isConfigFileExist && !overwriteConfig) {
            const message = `The ${APP_NAME} configuration file already exists.`;
            window.showWarningMessage(message, constants.view, constants.overwrite).then(async (selection) => {
                if (selection === constants.view) {
                    showTextDocument(configFilePath);
                }
                if (selection === constants.overwrite) {
                    await commands.executeCommand(extCommands.generateConfiguration, true);
                }
            });
            return;
        }

        // Generate the config file
        await fs.ensureFile(configFilePath);
        await fs.outputJSON(configFilePath, configTemplate, { spaces: getTabWidth(), EOL, encoding: 'utf-8' });

        // Show success message
        window
            .showInformationMessage(`The configuration has been generated successfully!`, constants.viewConfig)
            .then((selection) => {
                if (selection === constants.viewConfig) {
                    showTextDocument(configFilePath);
                }
            });

        // Open the config file
        showTextDocument(configFilePath);

        // Refresh activity
        await commands.executeCommand(extCommands.refreshInfoView);
    } catch (error) {
        const message = `Failed to generate the configuration!`;
        logger.error(message, error);
        showErrorMessageWithDetail(message, error);
    }
};
