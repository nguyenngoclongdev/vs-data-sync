import { ParsedDiff } from 'diff';
import fs from 'fs-extra';
import groupBy from 'lodash.groupby';
import { EOL } from 'node:os';
import { FileManager } from '../../utils/fileManager';
import { logger } from '../../utils/logger';
import { makeDeleteQuery, makeInsertQuery, makeUpdateQuery } from '../../utils/query';
import { PatternSession, TableConfig, getTabWidth, getTablePrimaryKey } from '../../utils/utils';

const writePlanOutput = async (filePath: string, lines: string[]): Promise<string> => {
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
 * Generate plan files
 * - migrations/<migrate-name>/plan/all.sql
 * - migrations/<migrate-name>/plan/insert.sql
 * - migrations/<migrate-name>/plan/update.sql
 * - migrations/<migrate-name>/plan/delete.sql
 * Append the migrate info to file
 * - migrations/<migrate-name>/session.json
 */
export const generatePlanAsync = async (options: {
    fileManager: FileManager;
    tables: TableConfig[];
}): Promise<boolean> => {
    const { fileManager, tables } = options;

    // Read plan detail
    const sessionPath = fileManager.getSessionPath();
    const session: PatternSession = await fs.readJson(sessionPath);

    // Get plan file path
    const allPlanLines: string[] = [];
    const insertPlanLines: string[] = [];
    const updatePlanLines: string[] = [];
    const deletePlanLines: string[] = [];
    for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        allPlanLines.push(`${EOL}-- ${table.name}`);

        // Init count
        session.plan[table.name] = {
            ...session.plan[table.name],
            insert: 0,
            update: 0,
            delete: 0
        };

        const diffPatchFilePath = fileManager.getStructuredOutputPath(table.name);
        const diffPatchContent: ParsedDiff = await fs.readJson(diffPatchFilePath);
        const isChanges = diffPatchContent.hunks && diffPatchContent.hunks.length > 0;
        if (!isChanges) {
            allPlanLines.push(`-- No Changes`);
            continue;
        }

        if (i !== 0) {
            insertPlanLines.push(EOL);
            updatePlanLines.push(EOL);
            deletePlanLines.push(EOL);
        }

        for (let j = 0; j < diffPatchContent.hunks.length; j++) {
            const hunk = diffPatchContent.hunks[j];
            const isLineChanges = hunk && hunk.lines && hunk.lines.length > 0;
            if (!isLineChanges) {
                continue;
            }

            // Get plan detail for table
            const planDetail = session.plan[table.name];

            // if lines [length == 1] => insert/remove
            if (hunk.lines.length === 1) {
                const line = hunk.lines[0];

                // Line start with '+' => insert
                if (line.startsWith('+')) {
                    const values = JSON.parse(line.substring(1));
                    const insertQuery = makeInsertQuery(table, planDetail, values);
                    allPlanLines.push(insertQuery);
                    insertPlanLines.push(insertQuery);
                    planDetail.insert++;
                    continue;
                }

                // Line start with '-' => remove
                if (line.startsWith('-')) {
                    const values = JSON.parse(line.substring(1));
                    const deleteQuery = makeDeleteQuery(table, planDetail, values);
                    allPlanLines.push(deleteQuery);
                    deletePlanLines.push(deleteQuery);
                    planDetail.delete++;
                    continue;
                }
            }

            // if lines [length > 1] => insert/update/remove
            if (hunk.lines.length > 1) {
                // Group lines by primary key of table
                const groupByPrimaryKey = groupBy(hunk.lines, (line) => {
                    const currentLine = line.substring(1);
                    const currentRecord = JSON.parse(currentLine);
                    return getTablePrimaryKey(table, planDetail, currentRecord);
                });

                Object.values(groupByPrimaryKey).forEach((groupItems) => {
                    if (groupItems.length >= 3) {
                        const errorMessage = 'Could not detect operation of the records!';
                        logger.error(errorMessage, groupItems);
                        const error = new Error(errorMessage);
                        error.stack = JSON.stringify(groupItems, null, 2);
                        throw error;
                    }

                    // groupItems size = 1 => insert/update/delete
                    // if not start with operation [+]/[-] => out of scope
                    if (groupItems.length === 1) {
                        const rawCurrentLine = groupItems[0];
                        const operation = rawCurrentLine.substring(0, 1);
                        const currentLine = rawCurrentLine.substring(1);
                        const currentRecord = JSON.parse(currentLine);
                        switch (operation) {
                            case '+': {
                                const insertQuery = makeInsertQuery(table, planDetail, currentRecord);
                                allPlanLines.push(insertQuery);
                                insertPlanLines.push(insertQuery);
                                planDetail.insert++;
                                break;
                            }
                            case '-': {
                                const deleteQuery = makeDeleteQuery(table, planDetail, currentRecord);
                                allPlanLines.push(deleteQuery);
                                deletePlanLines.push(deleteQuery);
                                planDetail.delete++;
                                break;
                            }
                            default: {
                                const errorMessage = 'The operation not start with [+/-]!';
                                logger.error(errorMessage, groupItems);
                                const error = new Error(errorMessage);
                                error.stack = JSON.stringify(groupItems, null, 2);
                                throw error;
                            }
                        }
                    }

                    // groupItems size = 2, and has operation [+] and [-] => update
                    // if not have operation [+] and [-] => out of scope
                    if (groupItems.length === 2) {
                        const rawCurrentLine = groupItems[0];
                        const sameCurrentLine = groupItems[1];
                        if (rawCurrentLine.startsWith('+') && sameCurrentLine.startsWith('-')) {
                            const record = JSON.parse(rawCurrentLine.substring(1));
                            const updateQuery = makeUpdateQuery(table, planDetail, record);
                            allPlanLines.push(updateQuery);
                            updatePlanLines.push(updateQuery);
                            planDetail.update++;
                        } else if (rawCurrentLine.startsWith('-') && sameCurrentLine.startsWith('+')) {
                            const record = JSON.parse(sameCurrentLine.substring(1));
                            const updateQuery = makeUpdateQuery(table, planDetail, record);
                            allPlanLines.push(updateQuery);
                            updatePlanLines.push(updateQuery);
                            planDetail.update++;
                        } else {
                            const errorMessage = 'The operation of records maybe duplicate!';
                            logger.error(errorMessage, groupItems);
                            const error = new Error(errorMessage);
                            error.stack = JSON.stringify(groupItems, null, 2);
                            throw error;
                        }
                    }
                });
            }
        }
    }

    // Output count changes to file
    await fs.outputJSON(sessionPath, session, { spaces: getTabWidth() });
    logger.info(`The ${sessionPath} was successfully updated.`);

    // Output all plan files
    const allPlanFilePath = fileManager.getPlanOutputPath('all');
    await writePlanOutput(allPlanFilePath, allPlanLines);
    logger.info(`The ${allPlanFilePath} was successfully generated.`);

    // Output all plan files
    const insertPlanFilePath = fileManager.getPlanOutputPath('insert');
    await writePlanOutput(insertPlanFilePath, insertPlanLines);
    logger.info(`The ${insertPlanFilePath} was successfully generated.`);

    // Output all plan files
    const updatePlanFilePath = fileManager.getPlanOutputPath('update');
    await writePlanOutput(updatePlanFilePath, updatePlanLines);
    logger.info(`The ${updatePlanFilePath} was successfully generated.`);

    // Output all plan files
    const deletePlanFilePath = fileManager.getPlanOutputPath('delete');
    await writePlanOutput(deletePlanFilePath, deletePlanLines);
    logger.info(`The ${deletePlanFilePath} was successfully generated.`);
    return true;
};
