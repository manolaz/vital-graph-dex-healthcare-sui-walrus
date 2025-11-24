#[test_only]
module vital_graph::vital_graph_tests;

use sui::clock;
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario;
use vital_graph::vital_graph::{Self, DigitalTwin, DataPool};

// Test Addresses
const ADMIN: address = @0xA;
const USER1: address = @0xB;
const USER2: address = @0xC;
const SUBSCRIBER: address = @0xD;

// Errors from the main module
const ENotOwner: u64 = 1;
const ERecordNotFound: u64 = 2;

#[test]
fun test_mint_digital_twin() {
    let mut scenario = test_scenario::begin(USER1);
    {
        vital_graph::mint_digital_twin(test_scenario::ctx(&mut scenario));
    };

    test_scenario::next_tx(&mut scenario, USER1);
    {
        let twin = test_scenario::take_from_sender<DigitalTwin>(&scenario);
        test_scenario::return_to_sender(&scenario, twin);
    };
    test_scenario::end(scenario);
}

#[test]
fun test_add_health_record() {
    let mut scenario = test_scenario::begin(USER1);
    let clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

    // Mint twin
    {
        vital_graph::mint_digital_twin(test_scenario::ctx(&mut scenario));
    };

    test_scenario::next_tx(&mut scenario, USER1);
    {
        let mut twin = test_scenario::take_from_sender<DigitalTwin>(&scenario);

        vital_graph::add_health_record(
            &mut twin,
            b"MRI_Scan",
            b"blob_123",
            b"metadata_json",
            b"iv_xyz",
            &clock,
            test_scenario::ctx(&mut scenario),
        );

        // Verify record exists by trying to get it (helper might not be testable without public access, but it is public)
        let _ = vital_graph::get_record(&twin, b"MRI_Scan");

        test_scenario::return_to_sender(&scenario, twin);
    };

    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = ENotOwner)]
fun test_add_health_record_not_owner() {
    let mut scenario = test_scenario::begin(USER1);
    let clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

    // Mint twin as USER1
    {
        vital_graph::mint_digital_twin(test_scenario::ctx(&mut scenario));
    };

    // Transfer to USER2
    test_scenario::next_tx(&mut scenario, USER1);
    {
        let twin = test_scenario::take_from_sender<DigitalTwin>(&scenario);
        sui::transfer::public_transfer(twin, USER2);
    };

    // USER2 tries to add record - should fail if contract checks internal owner field vs sender
    test_scenario::next_tx(&mut scenario, USER2);
    {
        let mut twin = test_scenario::take_from_sender<DigitalTwin>(&scenario);

        vital_graph::add_health_record(
            &mut twin,
            b"MRI_Scan",
            b"blob_123",
            b"metadata_json",
            b"iv_xyz",
            &clock,
            test_scenario::ctx(&mut scenario),
        );

        test_scenario::return_to_sender(&scenario, twin);
    };

    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

#[test]
fun test_create_pool() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        vital_graph::create_pool(
            b"Diabetes Research",
            b"Description",
            b"Type 2",
            100,
            test_scenario::ctx(&mut scenario),
        );
    };

    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let pool = test_scenario::take_shared<DataPool>(&scenario);
        test_scenario::return_shared(pool);
    };
    test_scenario::end(scenario);
}

#[test]
fun test_fund_pool() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        vital_graph::create_pool(
            b"Diabetes Research",
            b"Description",
            b"Type 2",
            100,
            test_scenario::ctx(&mut scenario),
        );
    };

    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let mut pool = test_scenario::take_shared<DataPool>(&scenario);
        let coin = coin::mint_for_testing<SUI>(1000, test_scenario::ctx(&mut scenario));

        vital_graph::fund_pool(
            &mut pool,
            coin,
            test_scenario::ctx(&mut scenario),
        );

        test_scenario::return_shared(pool);
    };
    test_scenario::end(scenario);
}

#[test]
fun test_stake_record() {
    let mut scenario = test_scenario::begin(USER1);
    let clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

    // Create Pool (ADMIN)
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        vital_graph::create_pool(
            b"Research Pool",
            b"Desc",
            b"All",
            100,
            test_scenario::ctx(&mut scenario),
        );
    };

    // Mint & Add Record (USER1)
    test_scenario::next_tx(&mut scenario, USER1);
    {
        vital_graph::mint_digital_twin(test_scenario::ctx(&mut scenario));
    };

    test_scenario::next_tx(&mut scenario, USER1);
    {
        let mut twin = test_scenario::take_from_sender<DigitalTwin>(&scenario);
        vital_graph::add_health_record(
            &mut twin,
            b"MyData",
            b"blob",
            b"meta",
            b"iv",
            &clock,
            test_scenario::ctx(&mut scenario),
        );
        test_scenario::return_to_sender(&scenario, twin);
    };

    // Stake Record (USER1)
    test_scenario::next_tx(&mut scenario, USER1);
    {
        let mut pool = test_scenario::take_shared<DataPool>(&scenario);
        let twin = test_scenario::take_from_sender<DigitalTwin>(&scenario);

        vital_graph::stake_record(
            &mut pool,
            &twin,
            b"MyData",
            test_scenario::ctx(&mut scenario),
        );

        test_scenario::return_shared(pool);
        test_scenario::return_to_sender(&scenario, twin);
    };

    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = ERecordNotFound)]
fun test_stake_record_not_found() {
    let mut scenario = test_scenario::begin(USER1);
    let clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

    // Create Pool
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        vital_graph::create_pool(
            b"Pool",
            b"Desc",
            b"Criteria",
            100,
            test_scenario::ctx(&mut scenario),
        );
    };

    // Mint Twin
    test_scenario::next_tx(&mut scenario, USER1);
    {
        vital_graph::mint_digital_twin(test_scenario::ctx(&mut scenario));
    };

    // Stake Non-existent
    test_scenario::next_tx(&mut scenario, USER1);
    {
        let mut pool = test_scenario::take_shared<DataPool>(&scenario);
        let twin = test_scenario::take_from_sender<DigitalTwin>(&scenario);

        vital_graph::stake_record(
            &mut pool,
            &twin,
            b"NonExistentRecord",
            test_scenario::ctx(&mut scenario),
        );

        test_scenario::return_shared(pool);
        test_scenario::return_to_sender(&scenario, twin);
    };

    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

#[test]
fun test_subscribe_and_access() {
    let mut scenario = test_scenario::begin(ADMIN);
    let clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

    // Create Pool
    {
        vital_graph::create_pool(
            b"Premium Data",
            b"High quality data",
            b"Criteria",
            100,
            test_scenario::ctx(&mut scenario),
        );
    };

    // Subscriber subscribes
    test_scenario::next_tx(&mut scenario, SUBSCRIBER);
    {
        let mut pool = test_scenario::take_shared<DataPool>(&scenario);
        let payment = coin::mint_for_testing<SUI>(100, test_scenario::ctx(&mut scenario));

        vital_graph::subscribe(
            &mut pool,
            payment,
            &clock,
            test_scenario::ctx(&mut scenario),
        );

        let active = vital_graph::check_subscription(&pool, SUBSCRIBER, &clock);
        assert!(active == true, 0);

        test_scenario::return_shared(pool);
    };

    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}
