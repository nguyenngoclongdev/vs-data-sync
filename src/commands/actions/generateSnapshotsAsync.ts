import fs from 'fs-extra';
import { EOL } from 'node:os';
import pg from 'pg';
import { QueryIterablePool } from 'pg-iterator';
import { FileManager, SnapshotType } from '../../utils/fileManager';
import { logger } from '../../utils/logger';
import {
    PatternConfig,
    PatternSession,
    TableConfig,
    getDatabaseInfo,
    getTabWidth,
    showInputPassword
} from '../../utils/utils';
import { store } from '../../utils/store';

const getPrimaryKeys = async (options: { pool: pg.Pool; table: TableConfig }): Promise<string[]> => {
    const { pool, table } = options;
    const rawQuery = `
        SELECT c.column_name
        FROM information_schema.table_constraints t
            JOIN information_schema.constraint_column_usage c
            ON c.constraint_name = t.constraint_name
        WHERE t.constraint_type = 'PRIMARY KEY' AND c.table_name = '${table.name}'`;
    const result = await pool.query(rawQuery);
    const primaryKeys = [];
    for (const row of result.rows) {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { column_name } = row as { column_name: string };
        primaryKeys.push(column_name);
    }
    return primaryKeys;
};

const getColumnNames = async (options: { pool: pg.Pool; table: TableConfig }): Promise<string[]> => {
    const { pool, table } = options;
    const rawQuery = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = '${table.name}'
        ORDER BY ordinal_position`;
    const result = await pool.query(rawQuery);
    const tableColumns = [];
    for await (const row of result.rows) {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { column_name } = row as { column_name: string };
        tableColumns.push(column_name);
    }
    return tableColumns;
};

export type GenerateSnapshotOptions = {
    pool: pg.Pool;
    fileManager: FileManager;
    snapshotType: SnapshotType;
    formatLine?: boolean;
    tables: TableConfig[];
    session: PatternSession;
};

export const createSnapshotFiles = async (options: GenerateSnapshotOptions): Promise<void> => {
    const { pool, fileManager, tables, snapshotType, session, formatLine = false } = options;
    const tab = getTabWidth();
    const qs = new QueryIterablePool(pool);
    try {
        for (let i = 0; i < tables.length; i++) {
            const table = tables[i];

            // Init detail table
            session.plan[table.name] = {
                primaryKeys: [],
                columns: [],
                insert: 0,
                update: 0,
                delete: 0
            };

            // Get primary key
            let primaryKeys = table.primaryKeys;
            if (!primaryKeys || primaryKeys.length <= 0) {
                primaryKeys = await getPrimaryKeys({ pool, table });
            }
            session.plan[table.name].primaryKeys = primaryKeys;

            // Get columns for table
            let tableColumns = table.columns;
            if (!tableColumns || tableColumns.length <= 0) {
                tableColumns = await getColumnNames({ pool, table });
            }
            session.plan[table.name].columns = tableColumns;

            // Remove column in exclude columns
            const excludeColumns = table.excludes || [];
            if (excludeColumns.length > 0) {
                tableColumns = tableColumns.filter((columnName) => !excludeColumns.includes(columnName));
            }

            // Generate select query
            const selectColumns = tableColumns.length > 0 ? tableColumns.map((tc) => `"${tc}"`).join(', ') : '*';
            const selectQuery = `SELECT ${selectColumns} FROM ${table.name}`;
            const where = table.where ? `WHERE ${table.where}` : '';
            const orderBy = table.orderBy ? `ORDER BY ${table.orderBy}` : '';
            const rawQuery = [selectQuery, where, orderBy].filter(Boolean).join(' ');

            // If existed the snapshot file, remove old file and create new empty file
            const snapshotPath = fileManager.getSnapshotFilePath(table.name, snapshotType);
            await fs.remove(snapshotPath);
            await fs.ensureFile(snapshotPath);

            // Get stream data from table
            logger.info(`Execute '${rawQuery}' at '${table.name}' table to create snapshot.`);
            const rows = qs.query(rawQuery);

            // Stream to snapshot file
            logger.info(`Stream ${table.name} data to ${snapshotPath} ...`);
            for await (const row of rows) {
                // TODO: format json line to easy diff with JSONL
                // const rowContent = formatLine ? JSON.stringify(row, null, tab) : JSON.stringify(row);
                const rowContent = JSON.stringify(row);
                fs.appendFileSync(snapshotPath, rowContent.concat(EOL), { encoding: 'utf-8' });
            }
            logger.info(`The ${table.name} data was successfully streamed .`);
        }

        // Save table detail
        const sessionPath = fileManager.getSessionPath();
        await fs.outputJSON(sessionPath, session, { spaces: tab });
        logger.info(`The ${sessionPath} was successfully created.`);
    } finally {
        if (qs) {
            qs.release();
        }
    }
};

/**
 * Generate snapshot files
 * - migrations/<migrate-name>/snapshots/original
 * - migrations/<migrate-name>/snapshots/modified
 * Create new migrate info file
 * - migrations/<migrate-name>/session.json
 */
export const generateSnapshotAsync = async (options: {
    fileManager: FileManager;
    selectedPattern: string;
    pattern: PatternConfig;
}): Promise<boolean> => {
    const { fileManager, selectedPattern, pattern } = options;

    // Init configuration
    const { source, target, diff } = pattern;
    const { format: formatLine = false, tables = [] } = diff || {};

    // Init session
    const session: PatternSession = {
        selectedPattern,
        plan: {}
    };

    // Show password input if not defined
    if (source.password === undefined) {
        const inputPassword = await showInputPassword('source', source);
        if (typeof inputPassword === 'undefined') {
            return false;
        }
        source.password = inputPassword;
    }
    if (target.password === undefined) {
        const inputPassword = await showInputPassword('target', target);
        if (typeof inputPassword === 'undefined') {
            return false;
        }
        target.password = inputPassword;
    }

    // Generate snapshot for original database (target apply)
    const targetPool = new pg.Pool(target);
    logger.info(`Generating target snapshot with db connection '${getDatabaseInfo(target)}'....`);
    await createSnapshotFiles({
        fileManager,
        pool: targetPool,
        snapshotType: SnapshotType.original,
        formatLine,
        session,
        tables
    });
    logger.info('The target snapshot files was successfully generated');

    // Generate snapshot for modified database (source changed)
    const sourcePool = new pg.Pool(source);
    logger.info(`Generating source snapshot with db connection '${getDatabaseInfo(source)}'....`);
    await createSnapshotFiles({
        fileManager,
        pool: sourcePool,
        snapshotType: SnapshotType.modified,
        formatLine,
        session,
        tables
    });
    logger.info('The source snapshot files was successfully generated');

    // Set password to store
    store.sourcePassword = source.password.toString();
    store.targetPassword = target.password.toString();
    return true;
};
