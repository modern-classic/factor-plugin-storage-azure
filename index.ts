/*
 * Copyright (C) 2020  Modern Classic Transportation LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { addFilter, addCallback } from '@factor/api';
import { serviceClient } from '@azure/storage-blob';
import { PostAttachment } from '@factor/attachment';

/**
 * Get the Azure Service Handle. In Azure speak, this is called the
 * serviceClient.
 * 
 * @author Seth Murphy
 * @remarks
 * It seems like every cloud service has some oddities concerning how
 * developers connect to the service, and Microsoft Azure is no
 * exception. For those coming from a .NET background (like myself),
 * Azure's connection method won't seem all that strange, but for modern
 * developers it can be. Azure uses a connection string, even for Blob
 * Storage. In the event you're using Azure Blob Storage for some other
 * purpose in your application, we use a unique name for our connection
 * string: FACTOR_AZURE_PLUGIN_CONNECTION_STRING.
 */
const getService = (): {
  service: serviceClient | undefined,
  containerName: string | undefined,
} => {
  const connectionString = process.env.FACTOR_AZURE_PLUGIN_CONNECTION_STRING;
  const containerName = process.env.FACTOR_AZURE_PLUGIN_CONTAINER_NAME;

  let service;

  if (connectionString) {
    service = serviceClient.fromConnectionString(connectionString);
  }

  return { service, containerName };
}

export const setup = (): void => {
  if (
    !process.env.FACTOR_AZURE_PLUGIN_CONTAINER_NAME ||
    !process.env.FACTOR_AZURE_PLUGIN_CONNECTION_STRING
  ) {
    addFilter({
      key: 'azureStorageSetup',
      hook: 'setup-needed',
      callback: (__: { title: string }[]) => {
        return [
          ...__,
          {
            title: 'Plugin: Azure Storage Connection String',
            file: '.env',
            name: 'FACTOR_AZURE_PLUGIN_CONNECTION_STRING'
          },
        ];
      },
    });

    return;
  }

  /**
   * Hook into Factor's upload attachment filter
   * 
   * @returns {String} The URL for the uploaded resource
   */
  addFilter({
    key: 'handleUrlAzure',
    hook: 'storage-attachment-url',
    callback: async ({
      buffer,
      key,
    }: {
      buffer: Buffer,
      key: string,
    }) => {
      const { service, containerName } = getService();

      if (!service || !containerName) return;

      const container = service.getContainerClient(containerName);
      if (!container.exists()) {
        await container.create();
      }

      const file = container.getBlockBlobClient(key);
      await file.upload(buffer, buffer.byteLength);

      return file.url;
    }
  });

  addCallback({
    key: 'deleteImageAzure',
    hook: 'delete-attachment',
    callback: async (doc: PostAttachment) => {
      const { service, containerName } = getService();

      if (!service || !containerName) return;

      const container = service.getContainerClient(containerName);
      const key = doc.url.split(`${containerName}/`)[1];
      const file = container.getBlockBlobClient(key);

      await file.delete();

      return;
    }
  });
}

setup();
