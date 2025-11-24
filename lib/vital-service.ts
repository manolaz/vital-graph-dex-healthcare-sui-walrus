import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";

// Constants
const PACKAGE_ID = "0xf54a608b303446261a1022d9ba53f9e5a30a6fbf8150d320ffae9b095f0c2524"; // Replace with deployed package ID
const MODULE_NAME = "vital_graph";

export interface HealthRecord {
  name: string;
  blobId: string;
  metadata: string;
  timestamp: number;
  verified: boolean;
}

export interface DigitalTwin {
  id: string;
  reputation: number;
  records: HealthRecord[];
}

export interface DataPool {
    id: string;
    name: string;
    description: string;
    criteria: string;
    balance: number;
    dataCount: number;
    subscriptionPrice: number;
    owner: string;
}

export const vitalService = {
  getClient() {
    return new SuiClient({ url: getFullnodeUrl("testnet") });
  },

  async getDigitalTwin(address: string): Promise<DigitalTwin | null> {
    const client = this.getClient();
    
    // 1. Find the DigitalTwin object owned by the user
    const ownedObjects = await client.getOwnedObjects({
      owner: address,
      filter: { StructType: `${PACKAGE_ID}::${MODULE_NAME}::DigitalTwin` },
      options: { showContent: true }
    });

    if (ownedObjects.data.length === 0) return null;

    const obj = ownedObjects.data[0].data?.content as any;
    const id = ownedObjects.data[0].data?.objectId;
    
    // 2. Fetch Dynamic Fields (Health Records)
    const fields = await client.getDynamicFields({ parentId: id! });
    const records: HealthRecord[] = [];

    for (const field of fields.data) {
        const fieldObj = await client.getObject({
            id: field.objectId,
            options: { showContent: true }
        });
        const record = (fieldObj.data?.content as any).fields.value.fields;
        records.push({
            name: field.name.value,
            blobId: record.blob_id,
            metadata: record.metadata,
            timestamp: parseInt(record.timestamp),
            verified: record.verified
        });
    }

    return {
      id: id!,
      reputation: parseInt(obj.fields.reputation_score),
      records
    };
  },

  async getPool(id: string): Promise<DataPool | null> {
    const client = this.getClient();
    const obj = await client.getObject({
        id,
        options: { showContent: true }
    });
    
    if (!obj.data) return null;
    
    const content = obj.data.content as any;
    const fields = content.fields;
    
    return {
        id: obj.data.objectId,
        name: fields.name,
        description: fields.description,
        criteria: fields.criteria,
        balance: parseInt(fields.balance),
        dataCount: parseInt(fields.data_count),
        subscriptionPrice: parseInt(fields.subscription_price),
        owner: fields.owner
    };
  },

  async getPoolEvents(poolId: string) {
    const client = this.getClient();
    // Query for DataStaked events related to this pool
    const events = await client.queryEvents({
        query: { MoveModule: { package: PACKAGE_ID, module: MODULE_NAME } }
    });

    return events.data
        .filter((e: any) => e.type.includes("DataStaked") && e.parsedJson.pool_id === poolId)
        .map((e: any) => ({
            provider: e.parsedJson.provider,
            recordName: e.parsedJson.record_name,
            timestamp: e.timestampMs
        }));
  },

  async checkSubscription(poolId: string, userAddress: string): Promise<boolean> {
    // This is tricky without a view function or reading the Table directly via RPC
    // For now, we might assume we can read the table field if we know the Table ID from getPool
    // But checking a key in a Table via RPC requires `getDynamicFieldObject` on the table ID.
    // Let's implement that properly.
    
    const client = this.getClient();
    const poolObj = await client.getObject({ id: poolId, options: { showContent: true } });
    if (!poolObj.data) return false;
    const content = poolObj.data.content as any;
    const subscribersTableId = content.fields.subscribers.fields.id.id;

    try {
        const field = await client.getDynamicFieldObject({
            parentId: subscribersTableId,
            name: { type: "address", value: userAddress }
        });
        
        if (!field.data) return false;
        
        // Check expiration
        const expiration = parseInt((field.data.content as any).fields.value);
        return expiration > Date.now();
    } catch (e) {
        return false; // Field doesn't exist or error
    }
  },

  mintDigitalTwin() {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::mint_digital_twin`,
      arguments: []
    });
    return tx;
  },

  addHealthRecord(twinId: string, name: string, blobId: string, metadata: string, iv: string) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::add_health_record`,
      arguments: [
        tx.object(twinId),
        tx.pure.string(name),
        tx.pure.string(blobId),
        tx.pure.string(metadata),
        tx.pure.string(iv),
        tx.object("0x6") // Clock
      ]
    });
    return tx;
  },

  createPool(name: string, description: string, criteria: string, subscriptionPrice: number) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::create_pool`,
      arguments: [
        tx.pure.string(name),
        tx.pure.string(description),
        tx.pure.string(criteria),
        tx.pure.u64(subscriptionPrice)
      ]
    });
    return tx;
  },

  fundPool(poolId: string, coinId: string) {
      const tx = new Transaction();
      tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE_NAME}::fund_pool`,
          arguments: [
              tx.object(poolId),
              tx.object(coinId)
          ]
      });
      return tx;
  },

  subscribe(poolId: string, coinId: string) { // coinId or split coin object
      const tx = new Transaction();
      tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE_NAME}::subscribe`,
          arguments: [
              tx.object(poolId),
              tx.object(coinId), // User must provide a coin with >= subscriptionPrice
              tx.object("0x6")
          ]
      });
      return tx;
  },

  stakeRecord(poolId: string, twinId: string, recordName: string) {
      const tx = new Transaction();
      tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE_NAME}::stake_record`,
          arguments: [
              tx.object(poolId),
              tx.object(twinId),
              tx.pure.string(recordName)
          ]
      });
      return tx;
  },

  requestAccess(poolId: string, twinId: string, recordName: string, publicKey: string) {
      const tx = new Transaction();
      tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE_NAME}::request_access`,
          arguments: [
              tx.object(poolId),
              tx.object(twinId), // Note: In real app, this might need the owner's signature or be accessible via SharedObject/Listing
              tx.pure.string(recordName),
              tx.pure.string(publicKey),
              tx.object("0x6")
          ]
      });
      return tx;
  }
};
