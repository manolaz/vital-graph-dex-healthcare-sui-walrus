module vital_graph::vital_graph;

use std::string::{Self, String};
use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::dynamic_field;
use sui::event;
use sui::sui::SUI;
use sui::table::{Self, Table};
use sui::vec_set::{Self, VecSet};

// Errors
const ENotOwner: u64 = 1;
const ERecordNotFound: u64 = 2;
const ENotSubscribed: u64 = 3;
const EInsufficientPayment: u64 = 4;
const ENotStaked: u64 = 5;

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

/// Information about a staker in a pool.
public struct StakerInfo has store {
    staked_records: VecSet<String>,
    last_claim_timestamp: u64,
    unclaimed_rewards: u64,
}

/// A Liquidity Pool for specific data types.
public struct DataPool has key {
    id: sui::object::UID,
    name: String,
    description: String,
    criteria: String, // e.g., "Diabetes Type 2"
    balance: Balance<SUI>,
    subscription_price: u64, // Monthly price in SUI
    reward_rate: u64, // SUI per ms per record
    subscribers: Table<address, u64>, // Address -> Expiration Timestamp
    stakers: Table<address, StakerInfo>, // Address -> StakerInfo
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

public struct RecordUnstaked has copy, drop {
    pool_id: address,
    provider: address,
    record_name: String,
}

public struct RewardsClaimed has copy, drop {
    pool_id: address,
    provider: address,
    amount: u64,
}

public struct RecordVerified has copy, drop {
    twin_id: address,
    record_name: String,
    verifier: address,
}

public struct AccessGranted has copy, drop {
    pool_id: address,
    requestor: address,
    record_name: String,
    encrypted_key: String,
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
    reward_rate: u64,
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
        reward_rate,
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

/// Grant access response from Data Owner
public fun grant_access(
    pool: &DataPool,
    requestor: address,
    record_name: vector<u8>,
    encrypted_key: vector<u8>,
    _ctx: &mut sui::tx_context::TxContext,
) {
    // Typically would verify that sender owns the record, but here we simplify
    // assuming off-chain coordination or signature verification could happen.
    // For now, just emit the event so the requestor can pick it up.

    event::emit(AccessGranted {
        pool_id: sui::object::uid_to_address(&pool.id),
        requestor,
        record_name: string::utf8(record_name),
        encrypted_key: string::utf8(encrypted_key),
    });
}

/// Internal helper to calculate pending rewards
fun calculate_rewards(info: &StakerInfo, current_time: u64, reward_rate: u64): u64 {
    if (current_time <= info.last_claim_timestamp) {
        return 0
    };
    let time_diff = current_time - info.last_claim_timestamp;
    let record_count = vec_set::length(&info.staked_records);
    (time_diff * reward_rate * record_count)
}

/// Stake a record into the pool.
public fun stake_record(
    pool: &mut DataPool,
    twin: &DigitalTwin,
    record_name: vector<u8>,
    clock: &Clock,
    ctx: &mut sui::tx_context::TxContext,
) {
    let name_str = string::utf8(record_name);
    assert!(dynamic_field::exists_(&twin.id, name_str), ERecordNotFound);

    let sender = sui::tx_context::sender(ctx);
    let current_time = sui::clock::timestamp_ms(clock);

    if (!table::contains(&pool.stakers, sender)) {
        let mut records = vec_set::empty<String>();
        vec_set::insert(&mut records, name_str);
        let info = StakerInfo {
            staked_records: records,
            last_claim_timestamp: current_time,
            unclaimed_rewards: 0,
        };
        table::add(&mut pool.stakers, sender, info);
    } else {
        let info = table::borrow_mut(&mut pool.stakers, sender);
        // Accrue rewards before modifying stake
        let pending = calculate_rewards(info, current_time, pool.reward_rate);
        info.unclaimed_rewards = info.unclaimed_rewards + pending;
        info.last_claim_timestamp = current_time;

        // Add record
        if (!vec_set::contains(&info.staked_records, &name_str)) {
            vec_set::insert(&mut info.staked_records, name_str);
        };
    };

    pool.data_count = pool.data_count + 1;

    event::emit(DataStaked {
        pool_id: sui::object::uid_to_address(&pool.id),
        provider: sender,
        record_name: string::utf8(record_name),
    });
}

/// Unstake a record from the pool.
public fun unstake_record(
    pool: &mut DataPool,
    record_name: vector<u8>,
    clock: &Clock,
    ctx: &mut sui::tx_context::TxContext,
) {
    let sender = sui::tx_context::sender(ctx);
    let name_str = string::utf8(record_name);
    let current_time = sui::clock::timestamp_ms(clock);

    assert!(table::contains(&pool.stakers, sender), ENotStaked);
    let info = table::borrow_mut(&mut pool.stakers, sender);

    // Accrue rewards
    let pending = calculate_rewards(info, current_time, pool.reward_rate);
    info.unclaimed_rewards = info.unclaimed_rewards + pending;
    info.last_claim_timestamp = current_time;

    if (vec_set::contains(&info.staked_records, &name_str)) {
        vec_set::remove(&mut info.staked_records, &name_str);
        pool.data_count = pool.data_count - 1;
    };

    event::emit(RecordUnstaked {
        pool_id: sui::object::uid_to_address(&pool.id),
        provider: sender,
        record_name: name_str,
    });
}

/// Claim accrued rewards.
public fun claim_rewards(pool: &mut DataPool, clock: &Clock, ctx: &mut sui::tx_context::TxContext) {
    let sender = sui::tx_context::sender(ctx);
    let current_time = sui::clock::timestamp_ms(clock);

    assert!(table::contains(&pool.stakers, sender), ENotStaked);
    let info = table::borrow_mut(&mut pool.stakers, sender);

    let pending = calculate_rewards(info, current_time, pool.reward_rate);
    let total_reward = info.unclaimed_rewards + pending;

    assert!(total_reward > 0, 0);

    info.unclaimed_rewards = 0;
    info.last_claim_timestamp = current_time;

    // Transfer rewards
    // Ensure pool has enough balance
    let pool_val = balance::value(&pool.balance);
    let reward_val = if (pool_val < total_reward) { pool_val } else { total_reward };

    let reward_coin = coin::take(&mut pool.balance, reward_val, ctx);
    sui::transfer::public_transfer(reward_coin, sender);

    event::emit(RewardsClaimed {
        pool_id: sui::object::uid_to_address(&pool.id),
        provider: sender,
        amount: reward_val,
    });
}

/// Verify a record (Researcher/Verifier).
public fun verify_record(
    twin: &mut DigitalTwin,
    record_name: vector<u8>,
    ctx: &mut sui::tx_context::TxContext,
) {
    // In a real scenario, we would check if sender is an authorized verifier or pool owner.
    // For simplicity, we assume anyone calling this is a "verifier" for now,
    // or we could restrict it to a specific capability.

    let name_str = string::utf8(record_name);
    assert!(dynamic_field::exists_(&twin.id, name_str), ERecordNotFound);

    let record: &mut HealthRecord = dynamic_field::borrow_mut(&mut twin.id, name_str);
    record.verified = true;

    twin.reputation_score = twin.reputation_score + 10;

    event::emit(RecordVerified {
        twin_id: sui::object::uid_to_address(&twin.id),
        record_name: name_str,
        verifier: sui::tx_context::sender(ctx),
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
    _ctx: &mut sui::tx_context::TxContext,
) {
    assert!(pool.owner == sui::tx_context::sender(_ctx), ENotOwner);
    pool.subscription_price = new_price;
}

// Getter for HealthRecord (helper)
public fun get_record(twin: &DigitalTwin, record_name: vector<u8>): &HealthRecord {
    dynamic_field::borrow(&twin.id, string::utf8(record_name))
}
