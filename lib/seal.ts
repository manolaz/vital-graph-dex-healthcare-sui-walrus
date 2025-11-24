import { SealClient, SessionKey, EncryptedObject } from "@mysten/seal";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { fromBase64, fromHex, toHex } from "@mysten/sui/utils";

// Use the same package ID as vital-service or import it
// For now, duplicating or we can move constants to a shared file
const PACKAGE_ID = "0xb07d03d94517ba5bf899199bb01236b6eabacd5d99c9f9178b58003e889b1af1";
const MODULE_NAME = "vital_graph";

// Testnet Seal Key Servers (from Seal docs/examples)
const SEAL_KEY_SERVERS = [
  "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75", 
  "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8"
];

export class SealService {
  private client: SealClient;
  private suiClient: SuiClient;

  constructor() {
    this.suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });
    this.client = new SealClient({
      suiClient: this.suiClient,
      serverConfigs: SEAL_KEY_SERVERS.map((id) => ({
        objectId: id,
        weight: 1,
      })),
      verifyKeyServers: false, // Set to true in production
    });
  }

  /**
   * Construct the Identity ID for Seal: [ProviderAddress][RecordName]
   */
  private getIdentity(providerAddress: string, recordName: string): Uint8Array {
    return bcs.struct('ID', {
      provider: bcs.Address,
      recordName: bcs.vector(bcs.U8),
    }).serialize({
      provider: providerAddress,
      recordName: new TextEncoder().encode(recordName),
    }).toBytes();
  }

  /**
   * Encrypts data using Seal (IBE)
   */
  async encryptHealthRecord(
    data: Uint8Array | string,
    providerAddress: string,
    recordName: string
  ) {
    const id = this.getIdentity(providerAddress, recordName);
    const idHex = toHex(id);

    const payload = typeof data === 'string' ? new TextEncoder().encode(data) : data;

    // Seal encryption
    const { encryptedObject: encryptedBytes, key: backupKey } = await this.client.encrypt({
      threshold: 1, // 1-out-of-N for now
      packageId: PACKAGE_ID,
      id: idHex, // Seal SDK expects Hex string without 0x? Docs say fromHEX(id), let's pass hex string
      data: payload,
    });

    // encryptedBytes is Uint8Array, return it and the IV/Metadata is embedded in it
    return {
      encryptedBytes,
      backupKey, // Helper to save if needed
    };
  }

  /**
   * Decrypts a health record using Seal
   * Requires user signature for SessionKey
   */
  async decryptHealthRecord(
    encryptedBytes: Uint8Array,
    providerAddress: string,
    recordName: string,
    userAddress: string,
    signMessage: (msg: Uint8Array) => Promise<{ signature: string }>,
    poolId?: string // If decrypting as subscriber, provide poolId. If owner, leave undefined.
  ) {
    // 1. Initialize Session Key
    const sessionKey = await SessionKey.create({
      address: userAddress,
      packageId: PACKAGE_ID,
      ttlMin: 60, // 1 hour
      suiClient: this.suiClient,
    });

    // 2. Check if session needs user approval
    if (!sessionKey.isValid()) {
      const message = sessionKey.getPersonalMessage();
      const { signature } = await signMessage(message);
      sessionKey.setPersonalMessageSignature(signature);
    }

    // 3. Construct Transaction for Access Policy
    const tx = new Transaction();
    const id = this.getIdentity(providerAddress, recordName);
    
    if (poolId) {
        // Subscriber Access
        tx.moveCall({
            target: `${PACKAGE_ID}::${MODULE_NAME}::seal_approve_subscriber`,
            arguments: [
                tx.pure.vector("u8", id),
                tx.object(poolId),
                tx.object("0x6") // Clock
            ]
        });
    } else {
        // Owner Access
        // We need the Twin ID. For owner, providerAddress is likely the owner address, 
        // but we need the Twin Object ID.
        // Let's fetch Twin ID based on providerAddress
        // For optimization, we might pass twinId instead of providerAddress if available.
        // But let's look it up.
        const ownedObjects = await this.suiClient.getOwnedObjects({
            owner: userAddress, // The user MUST be the owner to call seal_approve_owner
            filter: { StructType: `${PACKAGE_ID}::${MODULE_NAME}::DigitalTwin` }
        });
        
        if (ownedObjects.data.length === 0) {
             throw new Error("Digital Twin not found for owner");
        }
        const twinId = ownedObjects.data[0].data?.objectId;

        tx.moveCall({
            target: `${PACKAGE_ID}::${MODULE_NAME}::seal_approve_owner`,
            arguments: [
                tx.pure.vector("u8", id),
                tx.object(twinId!),
            ]
        });
    }

    // 4. Build TX Bytes
    // Seal expects specific build options
    const txBytes = await tx.build({ client: this.suiClient, onlyTransactionKind: true });

    // 5. Decrypt
    const decryptedBytes = await this.client.decrypt({
      data: encryptedBytes,
      sessionKey,
      txBytes,
    });

    return decryptedBytes;
  }
}

export const sealService = new SealService();

