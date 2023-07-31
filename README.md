<p align="center">
  <img src="images/logo.png" width="120" height="120" />
</p>

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/nguyenngoclong.data-sync)](https://marketplace.visualstudio.com/items?itemName=nguyenngoclong.data-sync)
[![Open VSX Installs](https://img.shields.io/open-vsx/dt/nguyenngoclong/data-sync?color=%2396C41F&label=open-vsx)](https://open-vsx.org/extension/nguyenngoclong/data-sync)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/nguyenngoclong.data-sync?label=vs-marketplace)](https://marketplace.visualstudio.com/items?itemName=nguyenngoclong.data-sync)
[![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/nguyenngoclong.data-sync)](https://marketplace.visualstudio.com/items?itemName=nguyenngoclong.data-sync)
[![Visual Studio Marketplace Rating (Stars)](https://img.shields.io/visual-studio-marketplace/stars/nguyenngoclong.data-sync)](https://marketplace.visualstudio.com/items?itemName=nguyenngoclong.data-sync)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)

# data-sync

`Data Sync` is an automated tool for comparing database schemas and data. It can compare two databases, whether they are local or remote, and automatically produce a migration file of the differences.

If you find this extension useful for your projects, please consider supporting me by [Patreon](https://patreon.com/nguyenngoclong), [KO-FI](https://ko-fi.com/nguyenngoclong) or [Paypal](http://paypal.com/paypalme/longnguyenngoc). It's a great way to help me maintain and improve this tool in the future. Your support is truly appreciated!

[![KO-FI](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/nguyenngoclong)
[![Paypal](https://img.shields.io/badge/PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white)](http://paypal.com/paypalme/longnguyenngoc)
[![Patreon](https://img.shields.io/badge/Patreon-F96854?style=for-the-badge&logo=patreon&logoColor=white)](https://patreon.com/nguyenngoclong)

# Installation

Get it from [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=nguyenngoclong.data-sync) or [Open VSX Registry](https://open-vsx.org/extension/nguyenngoclong/data-sync).

# Features

-   Connects to a source and target database to perform the comparison, locally or remotely.
-   Can compare changes to both the schema and data, and generate valid SQL to update the target database to match the source.
-   Allows you to ignore certain tables or fields during the comparison, using a YAML collection in the configuration file.
-   Performs the comparison very quickly, and has been tested with databases containing millions of rows across multiple tables.
-   Since this tool is primarily used for migrations, it provides both "up" and "down" SQL statements in the same file.
-   Currently only works with PostgreSQL, but we plan to expand to other databases based on user demand in the future.

## Introduction

### Connects to source and target database

### Automatically generate configuration

### Diff source and target database

### Apply changes to target database

## Feedback

If you discover a bug, or have a suggestion for a feature request, please
submit an [issue](https://github.com/nguyenngoclongdev/vs-data-sync/issues).

## LICENSE

This extension is licensed under the [MIT License](LICENSE)
