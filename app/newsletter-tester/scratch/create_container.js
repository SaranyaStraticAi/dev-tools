const { BlobServiceClient } = require('@azure/storage-blob');

async function main() {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
    
    const containerName = 'newsletter-assets';
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    try {
        await containerClient.createIfNotExists({ access: 'blob' });
        console.log(`Container "${containerName}" is ready and set to public read access.`);
    } catch (error) {
        console.error("Error:", error.message);
    }
}

main();
