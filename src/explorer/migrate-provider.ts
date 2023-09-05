import fs from 'fs-extra';
import { EOL } from 'node:os';
import path from 'node:path';
import { Event, EventEmitter, ThemeIcon, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { analyzeDataOnRefreshAsync } from '../commands/analyzeDataOnRefreshAsync';
import { FileManager } from '../utils/fileManager';
import { store } from '../utils/store';

export type MigrateTreeItem = TreeItem & {
    type?: 'all' | 'each';
    filePath?: string;
    fileName?: string;
    parent?: MigrateTreeItem;
};

export class MigrateProvider implements TreeDataProvider<MigrateTreeItem> {
    private _onDidChangeTreeData: EventEmitter<MigrateTreeItem | undefined | void> = new EventEmitter<
        MigrateTreeItem | undefined | void
    >();
    readonly onDidChangeTreeData: Event<MigrateTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    async refresh(skipReanalyze?: boolean): Promise<void> {
        // Re-analyze data (skip generate snapshot)
        if (!skipReanalyze && store.currentPattern && store.migrateName) {
            await analyzeDataOnRefreshAsync(store.currentPattern, store.migrateName);
        }

        // Refresh activity
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: MigrateTreeItem): MigrateTreeItem {
        return element;
    }

    async getChildren(element?: MigrateTreeItem): Promise<MigrateTreeItem[]> {
        // Init the FileManager
        const fileManager = FileManager.getInstance();
        if (!fileManager.isInit()) {
            return [];
        }

        // Generate parent items if no element is passed.
        if (!element) {
            const parentItems = await this.generateParent(fileManager);
            if (!parentItems || parentItems.length <= 0) {
                return [];
            }
            return parentItems;
        }

        // Generate child items if parent element is passed.
        const childItems = await this.generateChildren(fileManager, element);
        if (!childItems || childItems.length <= 0) {
            return [];
        }
        return childItems;
    }

    private generateParent = async (fileManager: FileManager): Promise<MigrateTreeItem[]> => {
        // Get all output file
        const migrateUpFilePath = fileManager.getMigrateUpPath();
        const migrateUpFileName = path.basename(migrateUpFilePath);
        const countAffected = await this.getCountAffected(migrateUpFilePath);

        // Get plugin tree item
        const treeItems: MigrateTreeItem[] = [];
        treeItems.push({
            // Built-in field
            id: migrateUpFileName,
            label: migrateUpFileName,
            tooltip: `Full Path: ${migrateUpFilePath}`,
            description: `${countAffected.insert} insert, ${countAffected.update} update, ${countAffected.delete} delete`,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            contextValue: 'migrate-context',
            iconPath: new ThemeIcon('output'),

            // Addition
            type: 'all',
            filePath: migrateUpFilePath,
            fileName: migrateUpFileName,
            parent: undefined
        });
        return treeItems;
    };

    private generateChildren = async (
        fileManager: FileManager,
        parentItem: MigrateTreeItem
    ): Promise<MigrateTreeItem[]> => {
        // Get all info of insert file
        const insertFilePath = fileManager.getPlanOutputPath('insert');
        const insertAffected = (await this.getCountAffected(insertFilePath)).insert;
        const insertItem = {
            filePath: insertFilePath,
            iconPath: new ThemeIcon('diff-added'),
            countAffected: `${insertAffected} insert`
        };

        // Get all info of update file
        const updateFilePath = fileManager.getPlanOutputPath('update');
        const updateAffected = (await this.getCountAffected(updateFilePath)).update;
        const updateItem = {
            filePath: updateFilePath,
            iconPath: new ThemeIcon('diff-modified'),
            countAffected: `${updateAffected} update`
        };

        // Get all info of delete file
        const deleteFilePath = fileManager.getPlanOutputPath('delete');
        const deleteAffected = (await this.getCountAffected(deleteFilePath)).delete;
        const deleteItem = {
            filePath: deleteFilePath,
            iconPath: new ThemeIcon('diff-removed'),
            countAffected: `${deleteAffected} delete`
        };

        // Get plugin tree item
        const treeItems: MigrateTreeItem[] = [];
        [insertItem, updateItem, deleteItem].forEach((item) => {
            const filePath = item.filePath;
            const fileName = path.basename(filePath);
            treeItems.push({
                // Built-in field
                id: `${parentItem.id}/${fileName}`,
                label: fileName,
                tooltip: `Full Path: ${item}`,
                description: item.countAffected,
                contextValue: 'migrate-context',
                iconPath: item.iconPath,

                // Addition
                type: 'each',
                filePath,
                fileName,
                parent: parentItem
            });
        });
        return treeItems;
    };

    private getCountAffected = async (
        filePath: string
    ): Promise<{
        insert: number;
        update: number;
        delete: number;
    }> => {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const countAffected = {
            insert: 0,
            update: 0,
            delete: 0
        };
        fileContent.split(EOL).forEach((line) => {
            if (line.startsWith('INSERT')) {
                countAffected.insert++;
            }
            if (line.startsWith('UPDATE')) {
                countAffected.update++;
            }
            if (line.startsWith('DELETE')) {
                countAffected.delete++;
            }
        });
        return countAffected;
    };
}
