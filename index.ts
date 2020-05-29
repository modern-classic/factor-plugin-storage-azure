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
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
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
  service: BlobServiceClient | undefined,
  containerName: string | undefined,
} => {
  const connectionString = process.env.FACTOR_AZURE_PLUGIN_CONNECTION_STRING;
  const containerName = process.env.FACTOR_AZURE_PLUGIN_CONTAINER_NAME;

  let service;

  if (connectionString)
    service = BlobServiceClient.fromConnectionString(connectionString);

  return { service, containerName };
};

/**
 * Due to the way Azure handles containers and their associated clients,
 * we abstract the functionality into another function. This way we can
 * not only get the client, but also ensure the container exists before
 * passing back to the other functions.
 *
 * @returns {ContainerClient} The client for the requested container
 */
const getContainer = async (): Promise<ContainerClient> => {
  return new Promise((resolve, reject) => {
    const { service, containerName } = getService();
    const container = service.getContainerClient(containerName);

    if (!container.exists())
      container.create().then((res) => { resolve(container) });
    else
      resolve(container);
  });
};

export const setup = (): void => {
  if (
    !process.env.FACTOR_AZURE_PLUGIN_CONTAINER_NAME ||
    !process.env.FACTOR_AZURE_PLUGIN_CONNECTION_STRING
  ) {
    addFilter({
      key: 'modernClassicAzureStorageSetup',
      hook: 'setup-needed',
      callback: (__: { title: string }[]) => {
        return [
          ...__,
          {
            title: 'Plugin: Azure Storage connection string',
            file: '.env',
            name: 'FACTOR_AZURE_PLUGIN_CONNECTION_STRING',
          },
        ];
      },
    });

    return;
  }

  addFilter({
    key: 'modernClassicAzureHandleUrl',
    hook: 'storage-attachment-url',
    priority: 200,
    callback: async ({
      buffer,
      key,
      mimetype,
    }: {
      buffer: Buffer,
      key: string,
      mimetype: string
    }) => {
      const { service, containerName } = getService();
      const container = await getContainer();
      if (!service || !containerName || !container) return;

      return new Promise((resolve, reject) => {
        const file = container.getBlockBlobClient(key);
        const length = Buffer.byteLength(buffer);

        file.upload(buffer, length, { 
          blobHTTPHeaders: { 
            blobContentType: mimetype,
          },
        })
        .then((res) => {
          if (!res.errorCode) resolve(file.url);
          else reject(res);
        })
        .catch((err) => {
          reject(err);
        });
      });
    },
  });

  addCallback({
    key: 'modernClassicAzureDeleteImage',
    hook: 'delete-attachment',
    callback: async (doc: PostAttachment) => {
      const { service, containerName } = getService();
      const container = await getContainer();
      if (!service || !containerName || !container) return;

      const key = doc.url.split(`${containerName}/`)[1];
      const file = container.getBlockBlobClient(key);

      return new Promise((resolve, reject) => {
        file.delete().then((res) => {
          if (!res.errorCode) resolve();
          else reject(res);
        })
        .catch((err) => {
          reject(err);
        });
      });
    },
  });
};

setup();
