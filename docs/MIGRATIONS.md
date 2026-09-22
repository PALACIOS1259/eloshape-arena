# EloShape migration history

Last reviewed against the staging project on 2026-09-22.

## Rules

1. Never rewrite an applied migration; add a forward migration.
2. Apply/validate on staging before production.
3. Migrations that only seed QA/demo data must never become an accidental production dependency.
4. SQL integration tests must be able to build a fresh local database from the repository migrations without relying on staging fixture rows.

## Repository migrations (43)

- `20260825151248_1abac606-f81c-49f6-991f-65cbfdcb9f99.sql` — Foundation / generated schema
- `20260825151303_29e55455-0d87-46af-bc94-5c10b72815e5.sql` — Foundation / generated schema
- `20260825164656_78f8ec2c-9af4-4871-8fca-a4f5ded6d2b4.sql` — Foundation / generated schema
- `20260826001733_f6991d6a-232b-4a8e-a3ef-c7b18033ff57.sql` — Foundation / generated schema
- `20260826001808_033a1515-5407-4b4a-9e4a-b73b9a72fd78.sql` — Foundation / generated schema
- `20260826003034_ec6939e5-7e54-4a3a-8ff3-94687a8085dd.sql` — Foundation / generated schema
- `20260826003052_4345a6da-01aa-4e54-b8c1-1680a772f051.sql` — Foundation / generated schema
- `20260826005145_03f25664-b566-4e58-b501-2da794e9be10.sql` — Foundation / generated schema
- `20260826005449_444eee38-8fca-45a4-ab7a-40db52e884d7.sql` — Foundation / generated schema
- `20260826005744_c18fc00a-3618-47ad-a034-f71f27b7107f.sql` — Foundation / generated schema
- `20260826005906_c4e6c9a5-3bdf-4f29-ad5e-127699bcfe15.sql` — Foundation / generated schema
- `20260826104500_authenticated_self_service.sql` — Auth / legal
- `20260826144500_authenticated_tournament_self_service.sql` — Competition
- `20260826190000_new_supabase_hardening.sql` — Security / performance
- `20260826190500_seed_rosario_open.sql` — Seed / fixture
- `20260826223500_authenticated_staff_console.sql` — Auth / legal
- `20260826230000_team_self_service.sql` — Teams
- `20260826232000_team_candidate_search.sql` — Teams
- `20260826233200_tournament_registration_mode_state.sql` — Competition
- `20260826234000_seed_rosario_gold_semisplit1_q1.sql` — Seed / fixture
- `20260826235000_rosario_gold_qualifiers_2_to_4.sql` — Competition
- `20260826235500_team_roster_role_and_captain_management.sql` — Teams
- `20260827101000_staff_split_operations.sql` — Competition
- `20260827141500_normalize_prelaunch_tournament_statuses.sql` — Competition
- `20260827141501_set_rosario_gold_qualifiers_to_16_teams.sql` — Competition
- `20260827142100_prelaunch_foreign_key_indexes.sql` — Security / performance
- `20260827143000_legal_acceptance_enforcement.sql` — Auth / legal
- `20260827143100_match_result_confirmation_and_disputes.sql` — Competition
- `20260827143200_allow_resubmit_after_dismissed_match_claim.sql` — Competition
- `20260827153500_lock_down_staff_split_ops_rpc.sql` — Competition
- `20260827202000_prelaunch_match_claim_indexes_and_rls_perf.sql` — Security / performance
- `20260827211000_support_and_account_deletion_requests.sql` — Support
- `20260827211800_support_request_profile_index.sql` — Security / performance
- `20260827224500_safe_team_archival.sql` — Teams
- `20260827230000_harden_archived_team_identity.sql` — Teams
- `20260910120000_audited_match_walkovers.sql` — Competition
- `20260910181920_safe_completed_match_corrections.sql` — Competition
- `20260910233000_count_walkovers_as_match_wins.sql` — Competition
- `20260915205500_team_lane_roles.sql` — Teams
- `20260916004500_harden_public_rpc_search_paths.sql` — Foundation / generated schema
- `20260922193000_qualifier_only_split_standings.sql` — Competition
- `20260922200000_scrims_and_qualifier_priority.sql` — Scrims
- `20260922201000_harden_scrim_rpc_privileges.sql` — Scrims

## Staging-only migration records not represented as promotion migrations

- `20260828130343 20260825151248_1abac606_f81c_49f6_991f_65cbfdcb9f99`
- `20260828130344 20260825151303_29e55455_0d87_46af_bc94_5c10b72815e5`
- `20260828130346 20260825164656_78f8ec2c_9af4_4871_8fca_a4f5ded6d2b4`
- `20260828130348 20260826001733_f6991d6a_232b_4a8e_a3ef_c7b18033ff57`
- `20260828130350 20260826001808_033a1515_5407_4b4a_9e4a_b73b9a72fd78`
- `20260828130352 20260826003034_ec6939e5_7e54_4a3a_8ff3_94687a8085dd`
- `20260828130354 20260826003052_4345a6da_01aa_4e54_b8c1_1680a772f051`
- `20260828130355 20260826005145_03f25664_b566_4e58_b501_2da794e9be10`
- `20260828130357 20260826005449_444eee38_8fca_45a4_ab7a_40db52e884d7`
- `20260828130359 20260826005744_c18fc00a_3618_47ad_a034_f71f27b7107f`
- `20260828130409 20260826005906_c4e6c9a5_3bdf_4f29_ad5e_127699bcfe15`
- `20260828130411 20260826104500_authenticated_self_service`
- `20260828130413 20260826144500_authenticated_tournament_self_service`
- `20260828130415 20260826190000_new_supabase_hardening`
- `20260828130417 20260826190500_seed_rosario_open`
- `20260828130418 20260826223500_authenticated_staff_console`
- `20260828130420 20260826230000_team_self_service`
- `20260828130421 20260826232000_team_candidate_search`
- `20260828130422 20260826233200_tournament_registration_mode_state`
- `20260828130424 20260826234000_seed_rosario_gold_semisplit1_q1`
- `20260828130437 20260826235000_rosario_gold_qualifiers_2_to_4`
- `20260828130439 20260826235500_team_roster_role_and_captain_management`
- `20260828130440 20260827101000_staff_split_operations`
- `20260828130442 20260827141500_normalize_prelaunch_tournament_statuses`
- `20260828130444 20260827141500_set_rosario_gold_qualifiers_to_16_teams`
- `20260828130445 20260827142100_prelaunch_foreign_key_indexes`
- `20260828130447 20260827143000_legal_acceptance_enforcement`
- `20260828130449 20260827143100_match_result_confirmation_and_disputes`
- `20260828130450 20260827143200_allow_resubmit_after_dismissed_match_claim`
- `20260828130452 20260827153500_lock_down_staff_split_ops_rpc`
- `20260828130453 20260827202000_prelaunch_match_claim_indexes_and_rls_perf`
- `20260828130455 20260827211000_support_and_account_deletion_requests`
- `20260828130456 20260827211800_support_request_profile_index`
- `20260828130458 20260827224500_safe_team_archival`
- `20260828130459 20260827230000_harden_archived_team_identity`
- `20260828131355 seed_staging_qa_16_team_fixture`
- `20260909130414 staging_connectivity_check`

The known `seed_staging_qa_16_team_fixture` record is a staging data fixture. Its purpose is QA data, not production schema behavior. It seeds synthetic QA users/teams and must not be used as an application dependency. Local/CI integration tests create transactional fixtures instead.

## Recent domain evolution

- **Competition foundation:** registration, staff console, team registration, roster snapshots and Semi-Splits.
- **Integrity hardening:** immutable snapshots, audited result claims/disputes, safe archival, foreign-key indexes.
- **Walkovers/corrections:** explicit resolution semantics, audited walkovers, safe completed-result corrections and walkover scoring.
- **Team UX:** lane roles and roster management.
- **Security:** public RPC search-path hardening and privilege tests.
- **Semi-Split correctness:** qualifier-only seeding standings.
- **Practice:** Scrim Finder plus qualified-team registration priority and scrim RPC privilege hardening.

For exact behavior, read the latest migration that defines a function; later `CREATE OR REPLACE FUNCTION` statements supersede earlier definitions.
