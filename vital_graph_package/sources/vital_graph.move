module vital_graph::vital_graph;

use std::string::{Self, String};
use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::event;
use sui::sui::SUI;
use sui::dynamic_field;
use sui::table::{Self, Table};

// Errors
const EInsufficientFunds: u64 = 0;
const ENotOwner: u64 = 1;
const ERecordNotFound: u64 = 2;

/// The Digital Twin representing a user's health identity.
public struct DigitalTwin has key, store {
    id: sui::object::UID,
    reputation_score: u64,
    owner: address,
}

/// A Health Record attached as a Dynamic Field to the Digital Twin.
public struct HealthRecord has store, drop, copy {
    blob_id: String,
    metadata: String,
    encryption_iv: String, // Base64 encoded IV
    verified: bool,
    timestamp: u64,
}

/// A Liquidity Pool for specific data types.
public struct DataPool has key {
    id: sui::object::UID,
    name: String,
    criteria: String, // e.g., "Diabetes Type 2"
    balance: Balance<SUI>,
    stakers: Table<address, u64>, // Address -> Staked Amount (mock score)
    data_count: u64,
}

/// Events
public struct DigitalTwinMinted has copy, drop {
    id: address,
    owner: address,
}

public struct HealthRecordAdded has copy, drop {
    twin_id: address,
    record_name: String,
    blob_id: String,
}

public struct PoolFunded has copy, drop {
    pool_id: address,
    amount: u64,
}

public struct DataStaked has copy, drop {
    pool_id: address,
    provider: address,
    record_name: String,
}

// --- Functions ---

/// Mint a new Digital Twin for the user.
public fun mint_digital_twin(ctx: &mut sui::tx_context::TxContext) {
    let sender = sui::tx_context::sender(ctx);
    let twin = DigitalTwin {
        id: sui::object::new(ctx),
        reputation_score: 0,
        owner: sender,
    };
    event::emit(DigitalTwinMinted {
        id: sui::object::uid_to_address(&twin.id),
        owner: sender,
    });
    sui::transfer::public_transfer(twin, sender);
}

/// Add a health record as a dynamic field to the Digital Twin.
public fun add_health_record(
    twin: &mut DigitalTwin,
    record_name: vector<u8>, // e.g., "MRI_Knee_2024"
    blob_id: vector<u8>,
    metadata: vector<u8>,
    encryption_iv: vector<u8>,
    clock: &sui::clock::Clock,
    ctx: &mut sui::tx_context::TxContext,
) {
    // Ensure sender is owner
    assert!(twin.owner == sui::tx_context::sender(ctx), ENotOwner);

    let record = HealthRecord {
        blob_id: string::utf8(blob_id),
        metadata: string::utf8(metadata),
        encryption_iv: string::utf8(encryption_iv),
        verified: false,
        timestamp: sui::clock::timestamp_ms(clock),
    };

    let name_str = string::utf8(record_name);
    
    // Add as dynamic field
    dynamic_field::add(&mut twin.id, name_str, record);

    event::emit(HealthRecordAdded {
        twin_id: sui::object::uid_to_address(&twin.id),
        record_name: string::utf8(record_name),
        blob_id: string::utf8(blob_id),
    });
}

/// Create a new Data Pool (Admin or Open).
public fun create_pool(
    name: vector<u8>,
    criteria: vector<u8>,
    ctx: &mut sui::tx_context::TxContext
) {
    let pool = DataPool {
        id: sui::object::new(ctx),
        name: string::utf8(name),
        criteria: string::utf8(criteria),
        balance: balance::zero(),
        stakers: table::new(ctx),
        data_count: 0,
    };
    sui::transfer::share_object(pool);
}

/// Fund the pool (Researchers).
public fun fund_pool(
    pool: &mut DataPool,
    payment: Coin<SUI>,
    _ctx: &mut sui::tx_context::TxContext
) {
    let amount = coin::value(&payment);
    balance::join(&mut pool.balance, coin::into_balance(payment));
    event::emit(PoolFunded {
        pool_id: sui::object::uid_to_address(&pool.id),
        amount,
    });
}

/// Stake a record into the pool.
/// In this simplified version, we just register the participation.
/// Real implementation would delegate access rights.
public fun stake_record(
    pool: &mut DataPool,
    twin: &DigitalTwin,
    record_name: vector<u8>,
    ctx: &mut sui::tx_context::TxContext
) {
    let name_str = string::utf8(record_name);
    assert!(dynamic_field::exists_(&twin.id, name_str), ERecordNotFound);
    
    let sender = sui::tx_context::sender(ctx);
    
    // Simple logic: Increment staker count or score
    if (!table::contains(&pool.stakers, sender)) {
        table::add(&mut pool.stakers, sender, 1);
    } else {
        let current_stake = table::borrow_mut(&mut pool.stakers, sender);
        *current_stake = *current_stake + 1;
    };
    
    pool.data_count = pool.data_count + 1;

    event::emit(DataStaked {
        pool_id: sui::object::uid_to_address(&pool.id),
        provider: sender,
        record_name: name_str,
    });
}

// Getter for HealthRecord (helper)
public fun get_record(twin: &DigitalTwin, record_name: vector<u8>): &HealthRecord {
    dynamic_field::borrow(&twin.id, string::utf8(record_name))
}

