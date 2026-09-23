# EloShape migration history

Last reviewed against staging and production registries on 2026-09-23.

## Rules

1. Never rewrite an applied migration; add a forward migration.
2. Apply/validate on staging before production.
3. Migrations that only seed QA/demo data must never become an accidental production dependency.
4. SQL integration tests must be able to build a fresh local database from the repository migrations without relying on staging fixture rows.

## Repository migrations (44)

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
- `20260923195500_count_walkovers_in_split_standings.sql` — Competition

## Staging migration-history notes

The live staging migration registry contains two environment-only records that are intentionally not production promotion migrations:

- `20260828131355 seed_staging_qa_16_team_fixture` — seeds synthetic QA staff/teams for staging.
- `20260909130414 staging_connectivity_check` — staging connectivity/diagnostic record.

The production registry currently ends at `harden_archived_team_identity` (2026-08-28). Before promotion, apply the nine migrations from `20260910120000_audited_match_walkovers.sql` through `20260923195500_count_walkovers_in_split_standings.sql` in repository order. Check actual registry names and schema before applying each migration; historical production records use different timestamps than repository filenames. Never reapply baseline seed files or the staging-only records.

There is also a historical timestamp-name mismatch for the qualifier-capacity correction: the live registry records `20260827141500_set_rosario_gold_qualifiers_to_16_teams`, while the repository keeps the forward file as `20260827141501_set_rosario_gold_qualifiers_to_16_teams.sql`. The behavior is represented in source; do not create a second production correction merely to make the historical labels identical.

Environment-only fixture records must not become application dependencies. Local/CI integration tests create transactional fixtures instead.

## Recent domain evolution

- **Competition foundation:** registration, staff console, team registration, roster snapshots and Semi-Splits.
- **Integrity hardening:** immutable snapshots, audited result claims/disputes, safe archival, foreign-key indexes.
- **Walkovers/corrections:** explicit resolution semantics, audited walkovers, safe completed-result corrections and walkover scoring.
- **Team UX:** lane roles and roster management.
- **Security:** public RPC search-path hardening and privilege tests.
- **Semi-Split correctness:** qualifier-only seeding standings.
- **Practice:** Scrim Finder plus qualified-team registration priority and scrim RPC privilege hardening.

For exact behavior, read the latest migration that defines a function; later `CREATE OR REPLACE FUNCTION` statements supersede earlier definitions.
