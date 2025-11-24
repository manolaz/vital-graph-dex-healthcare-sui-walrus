module vital_graph::vital_graph;

use std::string::{Self, String};
use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::dynamic_field;
use sui::event;
use sui::sui::SUI;
use sui::table::{Self, Table};

// Errors
const ENotOwner: u64 = 1;
const ERecordNotFound: u64 = 2;
const ENotSubscribed: u64 = 3;
const EInsufficientPayment: u64 = 4;

/// The Digital Twin representing a user's health identity.
public struct DigitalTwin has key, store {
    id: sui::object::UID,
    reputation_score: u64,
    owner: address,
}

/// A Health Record attached as a Dynamic Field to the Digital Twin.
public struct HealthRecord has copy, drop, store {
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
    description: String,
    criteria: String, // e.g., "Diabetes Type 2"
    balance: Balance<SUI>,
    subscription_price: u64, // Monthly price in SUI
    subscribers: Table<address, u64>, // Address -> Expiration Timestamp
    stakers: Table<address, u64>, // Address -> Staked Amount (mock score)
    data_count: u64,
    owner: address,
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

public struct SubscriptionPurchased has copy, drop {
    pool_id: address,
    subscriber: address,
    expiration: u64,
}

public struct DataAccessRequested has copy, drop {
    pool_id: address,
    subscriber: address,
    record_id: String,
    blob_id: String,
    public_key: String,
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
    clock: &Clock,
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
    description: vector<u8>,
    criteria: vector<u8>,
    subscription_price: u64,
    ctx: &mut sui::tx_context::TxContext,
) {
    let sender = sui::tx_context::sender(ctx);
    let pool = DataPool {
        id: sui::object::new(ctx),
        name: string::utf8(name),
        description: string::utf8(description),
        criteria: string::utf8(criteria),
        balance: balance::zero(),
        subscription_price,
        subscribers: table::new(ctx),
        stakers: table::new(ctx),
        data_count: 0,
        owner: sender,
    };
    sui::transfer::share_object(pool);
}

/// Fund the pool (Researchers).
public fun fund_pool(
    pool: &mut DataPool,
    payment: Coin<SUI>,
    _ctx: &mut sui::tx_context::TxContext,
) {
    let amount = coin::value(&payment);
    balance::join(&mut pool.balance, coin::into_balance(payment));
    event::emit(PoolFunded {
        pool_id: sui::object::uid_to_address(&pool.id),
        amount,
    });
}

/// Subscribe to the pool for 30 days (or custom duration based on payment).
public fun subscribe(
    pool: &mut DataPool,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &mut sui::tx_context::TxContext,
) {
    let sender = sui::tx_context::sender(ctx);
    let amount = coin::value(&payment);

    // Simple monthly logic: amount must be at least subscription_price
    assert!(amount >= pool.subscription_price, EInsufficientPayment);

    balance::join(&mut pool.balance, coin::into_balance(payment));

    let current_time = clock::timestamp_ms(clock);
    let duration_ms = 30 * 24 * 60 * 60 * 1000; // 30 days

    let new_expiration = if (table::contains(&pool.subscribers, sender)) {
        let current_expiry = *table::borrow(&pool.subscribers, sender);
        if (current_expiry > current_time) {
            current_expiry + duration_ms
        } else {
            current_time + duration_ms
        }
    } else {
        current_time + duration_ms
    };

    if (table::contains(&pool.subscribers, sender)) {
        *table::borrow_mut(&mut pool.subscribers, sender) = new_expiration;
    } else {
        table::add(&mut pool.subscribers, sender, new_expiration);
    };

    event::emit(SubscriptionPurchased {
        pool_id: sui::object::uid_to_address(&pool.id),
        subscriber: sender,
        expiration: new_expiration,
    });
}

/// Check if a user has an active subscription.
public fun check_subscription(pool: &DataPool, user: address, clock: &Clock): bool {
    if (!table::contains(&pool.subscribers, user)) {
        return false
    };
    let expiration = *table::borrow(&pool.subscribers, user);
    expiration > clock::timestamp_ms(clock)
}

/// Request access to a specific record (Seal integration pattern).
public fun request_access(
    pool: &mut DataPool,
    twin: &DigitalTwin, // The twin holding the record
    record_name: vector<u8>,
    public_key: vector<u8>, // User's public key for re-encryption
    clock: &Clock,
    ctx: &mut sui::tx_context::TxContext,
) {
    let sender = sui::tx_context::sender(ctx);

    // 1. Verify Subscription
    assert!(check_subscription(pool, sender, clock), ENotSubscribed);

    // 2. Verify Record Existence
    let name_str = string::utf8(record_name);
    assert!(dynamic_field::exists_(&twin.id, name_str), ERecordNotFound);

    let record: &HealthRecord = dynamic_field::borrow(&twin.id, name_str);

    // 3. Emit Access Request Event (for Seal Oracle / Backend to pick up)
    event::emit(DataAccessRequested {
        pool_id: sui::object::uid_to_address(&pool.id),
        subscriber: sender,
        record_id: name_str,
        blob_id: record.blob_id,
        public_key: string::utf8(public_key),
    });
}

/// Stake a record into the pool.
public fun stake_record(
    pool: &mut DataPool,
    twin: &DigitalTwin,
    record_name: vector<u8>,
    ctx: &mut sui::tx_context::TxContext,
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

/// Owner: Withdraw funds
public fun withdraw_funds(pool: &mut DataPool, ctx: &mut sui::tx_context::TxContext) {
    assert!(pool.owner == sui::tx_context::sender(ctx), ENotOwner);
    let amount = balance::value(&pool.balance);
    let cash = coin::take(&mut pool.balance, amount, ctx);
    sui::transfer::public_transfer(cash, pool.owner);
}

/// Owner: Set subscription price
public fun set_pool_price(
    pool: &mut DataPool,
    new_price: u64,
    ctx: &mut sui::tx_context::TxContext,
) {
    assert!(pool.owner == sui::tx_context::sender(ctx), ENotOwner);
    pool.subscription_price = new_price;
}

// Getter for HealthRecord (helper)
public fun get_record(twin: &DigitalTwin, record_name: vector<u8>): &HealthRecord {
    dynamic_field::borrow(&twin.id, string::utf8(record_name))
}
