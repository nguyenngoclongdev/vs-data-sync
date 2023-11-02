import { logger } from '../../utils/logger';
import { getDatabaseInfo } from '../../utils/utils';
import { Client, PoolConfig } from 'pg';

/**
 * Check database connection
 */
export const tryConnectionAsync = async (poolConfig: PoolConfig): Promise<boolean> => {
    let client: Client | undefined = undefined;
    try {
        client = new Client({
            host: poolConfig.host,
            user: poolConfig.user,
            password: poolConfig.password,
            port: poolConfig.port,
            database: poolConfig.database || 'postgres'
        });
        await client.connect();

        // Get current version
        const versionRes = await client.query(`SELECT current_setting('server_version_num') as ver_num;`);
        logger.info(`Connecting to the '${getDatabaseInfo(poolConfig)}' successful. Run on pg version ${versionRes}.`);
        return true;
    } catch (err) {
        logger.info(`Could not connect to the '${getDatabaseInfo(poolConfig)}'.`, err);
        return false;
    } finally {
        if (client) {
            await client.end();
            client = undefined;
        }
    }
};
