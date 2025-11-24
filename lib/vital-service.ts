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

  async getPool(id: string) {
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
        criteria: fields.criteria,
        balance: parseInt(fields.balance),
        dataCount: parseInt(fields.data_count),
        stakers: fields.stakers
    };
  },

  async getPoolEvents(poolId: string) {
    const client = this.getClient();
    // Query for DataStaked events related to this pool
    // Note: In a real indexer, we would filter by pool_id in the event
    // Here we fetch recent events and filter client-side for simplicity in this demo
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

  createPool(name: string, criteria: string) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::create_pool`,
      arguments: [
        tx.pure.string(name),
        tx.pure.string(criteria)
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
  }
};

