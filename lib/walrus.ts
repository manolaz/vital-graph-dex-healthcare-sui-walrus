// Utility functions for interacting with Walrus HTTP API
// Note: In a production environment, you should proxy these requests through your backend
// to handle CORS and securely manage publishing epochs.

// const PUBLISHER_URL = "https://publisher.walrus-testnet.walrus.space"
const AGGREGATOR_URL = "https://aggregator.walrus-testnet.walrus.space"

export interface BlobMetadata {
  blobId: string
  endEpoch: number
  suiBlobObjectId: string
}

/**
 * Stores data to Walrus
 * @param data - The string content or file to store
 * @param epochs - Number of epochs to store the data for (default 5)
 */
export async function storeBlob(data: string | File | Blob, epochs = 5): Promise<BlobMetadata> {
  // Use internal API proxy to avoid CORS
  const url = `/api/walrus/store?epochs=${epochs}`

  const response = await fetch(url, {
    method: "PUT",
    body: data,
  })

  if (!response.ok) {
    throw new Error(`Failed to store blob: ${response.statusText}`)
  }

  const json = await response.json()

  // Normalize response based on Walrus API structure (newlyCreated or alreadyCertified)
  if (json.newlyCreated) {
    return {
      blobId: json.newlyCreated.blobObject.blobId,
      endEpoch: json.newlyCreated.blobObject.storage.endEpoch,
      suiBlobObjectId: json.newlyCreated.blobObject.id,
    }
  } else if (json.alreadyCertified) {
    return {
      blobId: json.alreadyCertified.blobId,
      endEpoch: json.alreadyCertified.endEpoch,
      suiBlobObjectId: json.alreadyCertified.event.txDigest, // simplified
    }
  }

  throw new Error("Unexpected response format from Walrus Publisher")
}

/**
 * Reads a blob from Walrus
 * @param blobId - The ID of the blob to read
 */
export async function readBlob(blobId: string): Promise<Blob> {
  // Use internal API proxy to avoid CORS
  const url = `/api/walrus/read?blobId=${blobId}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to read blob: ${response.statusText}`)
  }

  return await response.blob()
}


/**
 * Stores pre-encrypted data to Walrus (e.g. Seal encrypted)
 */
export async function storePreEncryptedBlob(encryptedData: Blob | Uint8Array, epochs = 5): Promise<BlobMetadata> {
  const blob = encryptedData instanceof Blob ? encryptedData : new Blob([encryptedData]);
  return await storeBlob(blob, epochs);
}

// --- Encryption Utilities (DEPRECATED: Use Seal Service instead) ---

/** @deprecated Use Seal Service */
export async function generateKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("raw", key);
  const bytes = new Uint8Array(exported);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function importKey(base64Key: string): Promise<CryptoKey> {
  const binaryString = atob(base64Key);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return await window.crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptData(data: string | File, key: CryptoKey): Promise<{ encrypted: Blob, iv: Uint8Array }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  let encodedData: BufferSource;
  
  if (typeof data === 'string') {
    encodedData = new TextEncoder().encode(data);
  } else {
    encodedData = await data.arrayBuffer();
  }

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encodedData
  );

  return {
    encrypted: new Blob([encryptedBuffer]),
    iv
  };
}

export async function decryptData(encryptedBlob: Blob, key: CryptoKey, iv: Uint8Array): Promise<ArrayBuffer> {
  const encryptedBuffer = await encryptedBlob.arrayBuffer();
  
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encryptedBuffer
  );

  return decryptedBuffer;
}

export async function storeEncryptedBlob(data: string | File, key: CryptoKey, epochs = 5): Promise<BlobMetadata & { iv: string }> {
  const { encrypted, iv } = await encryptData(data, key);
  const metadata = await storeBlob(encrypted, epochs);
  
  let ivBinary = '';
  for (let i = 0; i < iv.length; i++) {
    ivBinary += String.fromCharCode(iv[i]);
  }

  return {
    ...metadata,
    iv: btoa(ivBinary)
  };
}
