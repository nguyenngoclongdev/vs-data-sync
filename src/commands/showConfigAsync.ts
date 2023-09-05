import fs from 'fs-extra';
import { commands, window } from 'vscode';
import { ConfigManager } from '../utils/configManager';
import { constants, extCommands } from '../utils/constants';
import { logger } from '../utils/logger';
import { showErrorMessageWithDetail, showTextDocument } from '../utils/utils';

export const showConfigAsync = async (): Promise<void> => {
    try {
        // If config file is existed, show the text document on vscode
        const configFilePath = ConfigManager.getInstance().getDefaultConfigFilePath();
        const isConfigFileExist = await fs.exists(configFilePath);
        if (isConfigFileExist) {
            showTextDocument(configFilePath);
            return;
        }

        // If config file is not exist, confirm to generate the config
        const quickPickItem = await window.showQuickPick(
            [constants.yes, constants.no].map((item) => ({ label: item })),
            {
                title: `Would you like to generate the configuration?`,
                placeHolder: `Choose "${constants.yes}" if you want to generate the configuration...`
            }
        );
        if (quickPickItem && quickPickItem.label === constants.yes) {
            await commands.executeCommand(extCommands.generateConfiguration);
        }
    } catch (error) {
        const message = `Failed to show configuration file!`;
        logger.error(message, error);
        showErrorMessageWithDetail(message, error);
    }
};
