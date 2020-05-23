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
function getService(): {
  service: BlobServiceClient | undefined,
  containerName: string | undefined,
} {
  const connectionString = process.env.FACTOR_AZURE_PLUGIN_CONNECTION_STRING;
  const containerName = process.env.FACTOR_AZURE_PLUGIN_CONTAINER_NAME;

  let service;

  if (connectionString)
    service = BlobServiceClient.fromConnectionString(connectionString);

  return { service, containerName };
}

/**
 * Due to the way Azure handles containers and their associated clients,
 * we abstract the functionality into another function. This way we can
 * not only get the client, but also ensure the container exists before
 * passing back to the other functions.
 *
 * @returns {ContainerClient} The client for the requested container
 */
async function getContainer(): Promise<ContainerClient> {
  const { service, containerName } = getService();
  const container = service.getContainerClient(containerName);
  
  if (!container.exists())
    await container.create();

  return container;
}

/**
 * Upload the file to Azure and return the URL associated with that file
 * 
 * @param {Buffer} buffer The buffer containing the file to be uploaded 
 * @param {string} key The string identifier Factor generated for the file
 * 
 * @returns {Promise<string>} The URL of the uploaded file
 */
async function handleUrl(buffer: Buffer, key: string): Promise<string> {
  const { service, containerName } = getService();
  const container = await getContainer();
  if (!service || !containerName || !container) return;

  const file = container.getBlockBlobClient(key);
  await file.upload(buffer, buffer.byteLength);

  return file.url;
}

/**
 * Deletes an image from Azure at the request of Factor
 * 
 * @param {PostAttachment} doc The image to be deleted
 */
async function handleDelete(doc: PostAttachment) {
  const { service, containerName } = getService();
  const container = await getContainer();
  if (!service || !containerName || !container) return;

  const key = doc.url.split(`${containerName}/`)[1];
  const file = container.getBlockBlobClient(key);

  await file.delete();

  return;
}

export function setup(): void {
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
    callback: handleUrl,
  });

  addCallback({
    key: 'modernClassicAzureDeleteImage',
    hook: 'delete-attachment',
    callback: handleDelete,
  });
}

setup();
