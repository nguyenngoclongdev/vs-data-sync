import { readJson } from 'fs-extra';
import { EOL } from 'node:os';
import { Event, EventEmitter, ThemeIcon, TreeDataProvider, TreeItem } from 'vscode';
import { analyzeDataOnRefreshAsync } from '../commands/analyzeDataOnRefreshAsync';
import { ConfigManager } from '../utils/configManager';
import { FileManager } from '../utils/fileManager';
import { store } from '../utils/store';
import { DataSyncConfig, PatternSession } from '../utils/utils';

export type CompareTreeItem = TreeItem & {
    parent?: CompareTreeItem;
    tableName?: string;
};

export class CompareProvider implements TreeDataProvider<CompareTreeItem> {
    private _onDidChangeTreeData: EventEmitter<CompareTreeItem | undefined | void> = new EventEmitter<
        CompareTreeItem | undefined | void
    >();
    readonly onDidChangeTreeData: Event<CompareTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    async refresh(skipReanalyze?: boolean): Promise<void> {
        // Re-analyze data (skip generate snapshot)
        if (!skipReanalyze && store.currentPattern && store.migrateName) {
            await analyzeDataOnRefreshAsync(store.currentPattern, store.migrateName);
        }

        // Refresh activity
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: CompareTreeItem): CompareTreeItem {
        return element;
    }

    async getChildren(): Promise<CompareTreeItem[]> {
        // Parse configuration
        const configManager = ConfigManager.getInstance();
        const configContent = configManager.getConfigContent();
        if (!configManager.isInit() || !configContent) {
            return [];
        }

        // Init the FileManager
        const fileManager = FileManager.getInstance();
        if (!fileManager.isInit()) {
            return [];
        }

        // Get the children of element or root if no element is passed.
        const childItems = await this.generateChildren(configContent, fileManager);
        if (!childItems || childItems.length <= 0) {
            return [];
        }
        return childItems;
    }

    private generateChildren = async (
        configContent: DataSyncConfig,
        fileManager: FileManager
    ): Promise<CompareTreeItem[]> => {
        // Read count change
        const sessionPath = fileManager.getSessionPath();
        const session: PatternSession = await readJson(sessionPath);

        // Init configuration
        const { patterns } = configContent;
        const pattern = patterns[store.currentPattern];
        const tables = pattern.diff.tables;
        if (!tables || tables.length <= 0) {
            return [];
        }

        // Get plugin tree item
        const treeItems: CompareTreeItem[] = [];
        tables.forEach((table) => {
            const countAffected: string[] = this.getCountAffected(session, table.name);
            treeItems.push({
                id: table.name,
                label: table.name,
                description: countAffected.length <= 0 ? 'no changes' : countAffected.join(', '),
                tooltip: countAffected.length <= 0 ? 'no changes' : `Compare:${EOL}${countAffected.join(EOL)}`,
                contextValue: 'compare-context',
                iconPath: new ThemeIcon('output'),

                // Addition
                tableName: table.name
            });
        });
        return treeItems;
    };

    private getCountAffected = (session: PatternSession, tableCode: string): string[] => {
        const tableCountAffected = session.plan[tableCode] || { insert: 0, update: 0, delete: 0 };
        const countAffected: string[] = [];
        if (tableCountAffected.insert !== 0) {
            countAffected.push(`${tableCountAffected.insert} insert`);
        }
        if (tableCountAffected.update !== 0) {
            countAffected.push(`${tableCountAffected.update} update`);
        }
        if (tableCountAffected.delete !== 0) {
            countAffected.push(`${tableCountAffected.delete} delete`);
        }
        return countAffected;
    };
}
