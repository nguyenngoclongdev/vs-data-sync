<p align="center">
  <img src="https://github.com/nguyenngoclongdev/cdn/raw/HEAD/images/data-sync/logo.png" width="120" height="120" />
</p>

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/nguyenngoclong.data-sync)](https://marketplace.visualstudio.com/items?itemName=nguyenngoclong.data-sync)
[![Open VSX Installs](https://img.shields.io/open-vsx/dt/nguyenngoclong/data-sync?color=%2396C41F&label=open-vsx)](https://open-vsx.org/extension/nguyenngoclong/data-sync)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/nguyenngoclong.data-sync?label=vs-marketplace)](https://marketplace.visualstudio.com/items?itemName=nguyenngoclong.data-sync)
[![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/nguyenngoclong.data-sync)](https://marketplace.visualstudio.com/items?itemName=nguyenngoclong.data-sync)
[![Visual Studio Marketplace Rating (Stars)](https://img.shields.io/visual-studio-marketplace/stars/nguyenngoclong.data-sync)](https://marketplace.visualstudio.com/items?itemName=nguyenngoclong.data-sync)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)

# data-sync

`Data Sync` is an automated tool for comparing database schemas and data. It can compare two databases, whether they are local or remote, and automatically produce a migration file of the differences.

If you find this extension useful for your projects, please consider supporting me by [Github](https://github.com/sponsors/nguyenngoclongdev), [Patreon](https://patreon.com/nguyenngoclong), [KO-FI](https://ko-fi.com/nguyenngoclong) or [Paypal](https://paypal.me/longnguyenngoc). It's a great way to help me maintain and improve this tool in the future. Your support is truly appreciated!

[![Github](https://img.shields.io/badge/Github-F15689?style=for-the-badge&logo=github&logoColor=white)](https://github.com/sponsors/nguyenngoclongdev)
[![Patreon](https://img.shields.io/badge/Patreon-F96854?style=for-the-badge&logo=patreon&logoColor=white)](https://patreon.com/nguyenngoclong)
[![KO-FI](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/nguyenngoclong)
[![Paypal](https://img.shields.io/badge/PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/longnguyenngoc)

# Installation

Get it from [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=nguyenngoclong.data-sync) or [Open VSX Registry](https://open-vsx.org/extension/nguyenngoclong/data-sync).

# Features

-   Connects to a source and target database to perform the comparison.
-   Can compare changes to both the schema and data, and generate valid SQL to update the target database to match the source.
-   Allows you to ignore certain tables or fields during the comparison.
-   Currently only works with PostgreSQL, but we plan to expand to other databases based on user demand in the future.

## Using the extension

### Step 1: Configuration

> On the first time, you need create the configuration.
> You can quickly create your configuration from [Data Sync Explorer](#generate-configuration-from-data-sync-explorer) or [Command Palette](#generate-configuration-from-command-palette).

```jsonc
// A Boolean variable indicating whether to include verbose log in migrate data.
"verbose": boolean,

// List of migrate pattern, multiple pattern can be defined.
"patterns": {
    // Your defined pattern
    "patternName": {
        // Your source database connection section
        "source": {
            "user": string,
            "password": string,
            "host": string,
            "database": string,
            "port": number,

            // database connection string
            "connectionString": string,

            // passed directly to node.TLSSocket, supports all tls.connect options
            "ssl": object,

            // custom type parsers
            "types": object,

            // number of milliseconds before a statement in query will time out, default is no timeout
            "statement_timeout": number,

            // number of milliseconds before a query call will timeout, default is no timeout
            "query_timeout": number,

            // the name of the application that created this Client instance
            "application_name": string,

            // number of milliseconds to wait for connection, default is no timeout
            "connectionTimeoutMillis": number,

            // number of milliseconds a client must sit idle in the pool
            "idleTimeoutMillis": number,

            // maximum number of clients the pool should contain by default this is set to 10.
            "max": object,

            // default behavior is the pool will keep clients open & connected
            "allowExitOnIdle": boolean,

            // Number of milliseconds before terminating any session with an open idle transaction, default is no timeout
            "idle_in_transaction_session_timeout": number
        },

        // Your target database connection section
        "target": {
            "user": string,
            "password": string,
            "host": string,
            "database": string,
            "port": number
            // And other property you can defined (same as source)
        },

        // You diff options
        "diff": {
            // Auto format diff data (UNDER DEVELOPMENT)
            "format": true,

            // The table you want to diff changes.
            "tables": [
                {
                    // The database table schema
                    "schema": string,

                    // The database table name
                    "name": string,

                    // Exclude one or more columns
                    "excludes": Array<string>,

                    // Custom where query (.e.g customer_id = 'JHQMFFE8sJ')
                    "where": string,

                    // Custom order by column (.e.g iam_role_code, iam_policy_code)
                    "orderBy": string,

                    // Define columns you want get to compare, default all column
                    "columns": Array<string>,

                    // Define primary keys of table, to check table row is unique
                    "primaryKeys": Array<string>
                }
            ]
        },

        // Your migrate options
        "migrate": {
            // No generate the insert record.
            "noInsert": false,

            // No generate the update record.
            "noUpdate": false,

            // No generate the delete record.
            "noDelete": false,

            // Action on no row affected when migrate data
            "noRowAffected": "ignore" | "log" | "warn" | "throw",

            // Action on multiple row affected when migrate data
            "multipleRowAffected": "ignore" | "log" | "warn" | "throw"
        }
    }
}
```

### Step 2: Analyze different data

![Analyze Diff Data](https://github.com/nguyenngoclongdev/cdn/raw/HEAD/images/data-sync/analyze-diff-data.gif)

### Step 3. Review changes

![Review Changes](https://github.com/nguyenngoclongdev/cdn/raw/HEAD/images/data-sync/review-changes.gif)

### Step 4. Review migrate file

![Review Migrate File](https://github.com/nguyenngoclongdev/cdn/raw/HEAD/images/data-sync/review-migrate-file.gif)

### Step 5. Apply changes

![Apply Changes](https://github.com/nguyenngoclongdev/cdn/raw/HEAD/images/data-sync/apply-changes.gif)

## Other

### Revert changes

![Revert Changes](https://github.com/nguyenngoclongdev/cdn/raw/HEAD/images/data-sync/revert-changes.gif)

### Import migration data

![Import Migration Data](https://github.com/nguyenngoclongdev/cdn/raw/HEAD/images/data-sync/import-migration-data.gif)

### View process info

![View Process Info](https://github.com/nguyenngoclongdev/cdn/raw/HEAD/images/data-sync/view-process-info.gif)

### Quick open configuration

![View Process Info](https://github.com/nguyenngoclongdev/cdn/raw/HEAD/images/data-sync/quick-open-config.gif)

### Generate Configuration from Data Sync Explorer

![From Data Sync Explorer](https://github.com/nguyenngoclongdev/cdn/raw/HEAD/images/data-sync/generate-config-from-explorer.gif)

### Generate Configuration from Command Palette

![From Command Palette](https://github.com/nguyenngoclongdev/cdn/raw/HEAD/images/data-sync/generate-config-from-command-palette.gif)

## Feedback

If you discover a bug, or have a suggestion for a feature request, please
submit an [issue](https://github.com/nguyenngoclongdev/vs-data-sync/issues).

## LICENSE

This extension is licensed under the [MIT License](LICENSE)
