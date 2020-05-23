# Overview

This plugin configures [Factor](https://factor.dev) to use Azure Blob Storage for image storage.

## Installation

```
npm add @modern-classic/factor-plugin-storage-azure
```

## Options and Settings

### Required Configuration (Factor application)

```ini
# .env / private keys and info

FACTOR_AZURE_PLUGIN_CONNECTION_STRING=""
FACTOR_AZURE_PLUGIN_CONTAINER_NAME=""

# REF - https://github.com/motdotla/dotenv
```

> After installation, run `npx factor setup` for an easy way to configure this plugin.

### Required Configuration (Azure Portal)

Unlike Google Cloud and Amazon S3, Azure does not, by default, allow unauthenticated to your storage containers. Therefore, you will need to make some minor changes to your storage account in the Azure Portal. For more information, please see [the Azure Documentation](https://docs.microsoft.com/en-us/azure/storage/blobs/storage-manage-access-to-resources?tabs=dotnet).

## How it works

This plugin uses Factor's filter system to automatically install and  configure itself. If you have properly setup your Connection String and other required information, it should work as intended.

## Factor Setup CLI

Run `npx factor setup` for a question based CLI to help you configure this plugin's options.
