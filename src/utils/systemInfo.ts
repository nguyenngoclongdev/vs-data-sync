import dayjs from 'dayjs';
import { arch, networkInterfaces, userInfo } from 'node:os';
import { ExtensionContext, version as editorVersion } from 'vscode';

export type SystemInfo = {
    [key: string]: string;
};

export const getSystemInfo = (context: ExtensionContext): SystemInfo => {
    const { eno1 } = networkInterfaces();
    const localIp = eno1?.[0].address;
    const executedAt = dayjs().format('YYYY-MM-DD HH:MM:ss');
    const { version = '' } = context.extension.packageJSON || {};
    return {
        cpu: arch(),
        ip: localIp || '',
        vscode: editorVersion || '',
        datasync: version || '',
        executedBy: userInfo().username,
        executedAt: executedAt
    };
};
