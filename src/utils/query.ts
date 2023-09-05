import { escape } from './escape';
import { TableConfig, TableDetail } from './utils';

export const isInsertQuery = (rawQuery: string | undefined): boolean => {
    if (!rawQuery) {
        return false;
    }
    return rawQuery.startsWith('INSERT INTO');
};

export const makeInsertQuery = (
    table: TableConfig,
    tableDetail: TableDetail,
    columnValues: { [key: string]: any }
): string => {
    const isExistedCreatedAt = columnValues['created_at'];
    const hasCreatedAtColumn = tableDetail.columns?.includes('created_at');
    if (!isExistedCreatedAt && hasCreatedAtColumn) {
        columnValues['created_at'] = 'NOW()';
    }

    const isExistedUpdatedAt = columnValues['updated_at'];
    const hasUpdatedAtColumn = tableDetail.columns?.includes('updated_at');
    if (!isExistedUpdatedAt && hasUpdatedAtColumn) {
        columnValues['updated_at'] = 'NOW()';
    }

    const columns = Object.keys(columnValues).join(', ');
    const values = Object.values(columnValues)
        .map((value) => {
            return escape(value);
        })
        .join(', ');
    return `INSERT INTO ${table.name} (${columns}) VALUES (${values});`;
};

export const isUpdateQuery = (rawQuery: string | undefined): boolean => {
    if (!rawQuery) {
        return false;
    }
    return rawQuery.startsWith('UPDATE');
};

export const makeUpdateQuery = (
    table: TableConfig,
    tableDetail: TableDetail,
    columnValues: { [key: string]: any }
): string => {
    const values = Object.entries(columnValues)
        .map(([column, value]) => {
            if (tableDetail.primaryKeys?.includes(column)) {
                return null; // Skip update field if is primary key
            }
            return `${column}=${escape(value)}`;
        })
        .filter(Boolean)
        .join(', ');
    return `UPDATE ${table.name} SET ${values} WHERE ${tableDetail.primaryKeys
        ?.map((p) => `${p}='${columnValues[p]}'`)
        .join(' AND ')};`;
};

export const isDeleteQuery = (rawQuery: string | undefined): boolean => {
    if (!rawQuery) {
        return false;
    }
    return rawQuery.startsWith('DELETE FROM');
};

export const makeDeleteQuery = (
    table: TableConfig,
    tableDetail: TableDetail,
    columnValues: { [key: string]: any }
): string => {
    return `DELETE FROM ${table.name} WHERE ${tableDetail.primaryKeys
        ?.map((p) => `${p}='${columnValues[p]}'`)
        .join(' AND ')};`;
};
