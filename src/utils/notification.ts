import { commands, window } from 'vscode';
import { constants, extCommands } from './constants';
import { store } from './store';

export const showNoConfigWarning = (message?: string): void => {
    const defaultNoConfigMessage = `Cannot find the configuration file. Would you like to create?`;
    window.showWarningMessage(message || defaultNoConfigMessage, constants.createConfig).then(async (selection) => {
        if (selection === constants.createConfig) {
            await commands.executeCommand(extCommands.generateConfiguration);
        }
    });
};

export const showIncorrectConfigWarning = (selectedPattern?: string, message?: string) => {
    const defaultIncorrectConfigMessage = `Incorrect configuration file for pattern '${
        selectedPattern || store.currentPattern
    }'. Would you like to view?`;
    window
        .showWarningMessage(message || defaultIncorrectConfigMessage, constants.viewConfig)
        .then(async (selection) => {
            if (selection === constants.viewConfig) {
                await commands.executeCommand(extCommands.showConfiguration);
            }
        });
};

export const showNoPatternWarning = (message?: string) => {
    const defaultNotPatternSelectMessage = `Your action could not be execute because you did not select any of the pattern.`;
    window.showWarningMessage(message || defaultNotPatternSelectMessage);
};

export const showIsAnalyzingWarning = (message?: string) => {
    const defaultIsAnalyzingMessage = `The data is still being analyzed. Please wait...`;
    window.showWarningMessage(message || defaultIsAnalyzingMessage);
};
