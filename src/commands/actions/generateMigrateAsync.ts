import fs from 'fs-extra';
import { EOL } from 'node:os';
import { FileManager } from '../../utils/fileManager';
import { logger } from '../../utils/logger';
import { isDeleteQuery, isInsertQuery, isUpdateQuery } from '../../utils/query';
import { PatternConfig } from '../../utils/utils';

const writeMigrateOutput = async (filePath: string, lines: string[]): Promise<string> => {
    await fs.outputFile(
        filePath,
        lines
            .join(EOL)
            .trim()
            .replace(/\n\s*\n/g, '\n\n')
    );
    return filePath;
};

/**
 * Generate migrate files
 * - migrations/<migrate-name>/migrate.up.sql
 * - migrations/<migrate-name>/migrate.down.sql
 */
export const generateMigrateAsync = async (options: {
    pattern?: PatternConfig;
    fileManager: FileManager;
    verbose: boolean | undefined;
}): Promise<boolean> => {
    const { fileManager, pattern, verbose = false } = options;
    const { migrate: migrateConfig } = pattern || {};

    // Get plan content
    const planFilePath = fileManager.getPlanOutputPath('all');
    const planContent = await fs.readFile(planFilePath, 'utf-8');
    const planLines = planContent.split(EOL);

    // Start insert/update
    const migrateUpLines: string[] = [];
    for (let i = 0; i < planLines.length; i++) {
        const rawQuery = planLines[i].trim();

        // Ignore if line is empty
        const isBlankLine = rawQuery === '';
        if (isBlankLine) {
            migrateUpLines.push(planLines[i]);
            continue;
        }

        // Ignore if line is comment
        const isCommentLine = rawQuery.startsWith('--');
        if (isCommentLine) {
            if (verbose) {
                migrateUpLines.push(planLines[i]);
            }
            continue;
        }

        // Ignore if not allow run insert
        const isNoInsert = migrateConfig?.noInsert && isInsertQuery(rawQuery);
        if (isNoInsert) {
            if (verbose) {
                migrateUpLines.push(`-- ${planLines[i]}`);
            }
            continue;
        }

        // Ignore if not allow run update
        const isNoUpdate = migrateConfig?.noUpdate && isUpdateQuery(rawQuery);
        if (isNoUpdate) {
            if (verbose) {
                migrateUpLines.push(`-- ${planLines[i]}`);
            }
            continue;
        }

        // Ignore if not allow run delete
        const isNoDelete = migrateConfig?.noDelete && isDeleteQuery(rawQuery);
        if (isNoDelete) {
            if (verbose) {
                migrateUpLines.push(`-- ${planLines[i]}`);
            }
            continue;
        }

        // Push to migrate lines
        migrateUpLines.push(planLines[i]);
    }

    // Write migrate data to file
    const migrateUpFilePath = fileManager.getMigrateUpPath();
    await writeMigrateOutput(migrateUpFilePath, migrateUpLines);
    logger.info(`The ${migrateUpFilePath} was successfully generated.`);
    return true;
};
