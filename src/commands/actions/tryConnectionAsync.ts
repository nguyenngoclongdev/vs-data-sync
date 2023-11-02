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
        logger.info(`Connecting to the '${getDatabaseInfo(poolConfig)}' successful.`);
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
