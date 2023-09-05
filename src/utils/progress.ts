import { Progress, window } from 'vscode';
import { logger } from './logger';

type ShowProgressOption = {
    // No write log
    noLog?: boolean;

    // No show progress report
    noReport?: boolean;
};

export const showProgressReport = (
    progress: Progress<{ message?: string | undefined; increment?: number | undefined }>,
    message: string,
    options?: ShowProgressOption
): void => {
    const { noLog = false, noReport = false } = options || {};
    if (!noLog) {
        logger.info(message);
    }
    if (!noReport) {
        progress.report({ message: message });
    }
};

export const showProgressWarn = (message: string, options?: ShowProgressOption) => {
    const { noLog = false, noReport = false } = options || {};
    if (!noLog) {
        logger.warn(message);
    }
    if (!noReport) {
        window.showWarningMessage(message);
    }
};

export const showProgressSuccess = (message: string, options?: ShowProgressOption) => {
    const { noLog = false, noReport = false } = options || {};
    if (!noLog) {
        logger.info(message);
    }
    if (!noReport) {
        window.showInformationMessage(message);
    }
};
