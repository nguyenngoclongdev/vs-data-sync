import { PatchOptions, createTwoFilesPatch, structuredPatch } from 'diff';
import fs from 'fs-extra';
import { FileManager, SnapshotType } from '../../utils/fileManager';
import { logger } from '../../utils/logger';
import { TableConfig, getTabWidth } from '../../utils/utils';

/**
 * Generate diff files
 * - migrations/<migrate-name>/diff/*.patch.diff
 * - migrations/<migrate-name>/diff/*.structured.diff
 */
export const generateDiffAsync = async (options: {
    fileManager: FileManager;
    tables: TableConfig[];
}): Promise<boolean> => {
    const { fileManager, tables } = options;

    // Diff file content (* update. + insert, - delete)
    for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        const originalFilePath = fileManager.getOriginalFilePath(table.name);
        const modifiedFilePath = fileManager.getModifiedFilePath(table.name);
        logger.info(`Comparing files between ${modifiedFilePath} and ${originalFilePath}`);

        // Read diff content
        const modifiedContent = await fs.readFile(modifiedFilePath, 'utf-8');
        const originalContent = await fs.readFile(originalFilePath, 'utf-8');
        const patchOptions: PatchOptions = { context: 0 };

        // Generate diff viewer file
        const diffViewerContent = createTwoFilesPatch(
            originalFilePath,
            modifiedFilePath,
            originalContent,
            modifiedContent,
            SnapshotType.original,
            SnapshotType.modified,
            patchOptions
        );
        const diffFilePath = fileManager.getDiffOutputPath(table.name);
        await fs.outputFile(diffFilePath, diffViewerContent);
        logger.info(`The ${diffFilePath} was successfully generated.`);

        // Write changes to file
        const patchContent = structuredPatch(
            originalFilePath,
            modifiedFilePath,
            originalContent,
            modifiedContent,
            SnapshotType.original,
            SnapshotType.modified,
            patchOptions
        );
        const structuredFilePath = fileManager.getStructuredOutputPath(table.name);
        await fs.outputJSON(structuredFilePath, patchContent, { spaces: getTabWidth() });
        logger.info(`The ${structuredFilePath} was successfully generated.`);
    }
    return true;
};
