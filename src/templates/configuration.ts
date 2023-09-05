/* eslint-disable @typescript-eslint/naming-convention */
import { DataSyncConfig } from '../utils/utils';

export const SchemaVersion = {
    v1: '/v1/',
    latest: '/v1/'
};

export const latestSchema = `https://cdn.statically.io/gh/nguyenngoclongdev/cdn/main/schema${SchemaVersion.latest}data-sync.json`;
export const configTemplate: DataSyncConfig = {
    $schema: latestSchema,
    verbose: false,
    patterns: {
        patternName: {
            source: {
                database: '',
                host: '',
                port: 5432,
                user: '',
                password: ''
            },
            target: {
                database: '',
                host: '',
                port: 5432,
                user: '',
                password: ''
            },
            diff: {
                format: true,
                tables: [
                    {
                        name: 'abc',
                        orderBy: 'id, code'
                    },
                    {
                        name: 'def',
                        where: "id = '1'",
                        orderBy: 'name'
                    }
                ]
            },
            migrate: {
                noInsert: false,
                noUpdate: false,
                noDelete: false,
                noRowAffected: 'warn',
                multipleRowAffected: 'throw'
            }
        }
    }
};
