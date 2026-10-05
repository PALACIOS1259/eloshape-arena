# EloShape RPC and database-function reference

Generated from the live staging catalog on 2026-09-22.

## Reading this document

- `public` functions are API-facing or shared SQL helpers. Execution is still controlled by grants/RLS/function logic.
- `private` functions are trusted implementation primitives and should not become general browser endpoints.
- `SECURITY DEFINER` means the function executes with owner privileges; these functions must enforce caller authorization and a restricted `search_path`.

## public schema

| Function | Arguments | Returns | Security | Purpose |
| --- | --- | --- | --- | --- |
| `archive_my_team` | `` | `jsonb` | SECURITY DEFINER | Safely archives the current captain's team while preserving historical references. |
| `cancel_my_scrim` | `p_scrim uuid` | `jsonb` | SECURITY DEFINER | Cancels a non-completed scrim owned by the caller's captain team. |
| `cancel_my_team_invite` | `p_invite_id uuid` | `jsonb` | SECURITY DEFINER | Cancels a pending invitation issued by the current captain. |
| `challenge_scrim` | `p_scrim uuid` | `jsonb` | SECURITY DEFINER | Creates or reopens a challenge from the caller's team to an open scrim. |
| `check_in_my_team_tournament` | `p_slug text` | `jsonb` | SECURITY DEFINER | Checks the caller's team into a team tournament after validating the team/roster. |
| `check_in_my_tournament` | `p_slug text` | `jsonb` | SECURITY DEFINER | Checks the caller into a solo tournament. |
| `create_my_scrim` | `p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_best_of integer, p_note text` | `jsonb` | SECURITY DEFINER | Posts a future practice window for the caller's team. |
| `create_my_team` | `p_name text, p_tag text` | `jsonb` | SECURITY DEFINER | Creates a team and makes the caller captain. |
| `ensure_my_profile` | `` | `uuid` | SECURITY DEFINER | Returns/provisions the authenticated user's profile. |
| `get_my_match_result` | `p_match uuid` | `jsonb` | SECURITY DEFINER | Returns the caller-visible result claim state for one official match. |
| `get_my_scrim_hub` | `` | `jsonb` | SECURITY DEFINER | Returns current team, scrims and challenge state for Scrim Finder. |
| `get_my_support_requests` | `` | `jsonb` | SECURITY DEFINER | Returns support requests belonging to the current user. |
| `get_my_team_hub` | `` | `jsonb` | SECURITY DEFINER | Returns current roster, invitations and captain state for Team HQ. |
| `get_my_tournament_entry` | `p_slug text` | `jsonb` | SECURITY DEFINER | Returns the caller's registration/check-in state for a tournament. |
| `invite_my_team_member` | `p_handle text, p_role text` | `jsonb` | SECURITY DEFINER | Invites a profile by handle as starter/player or substitute. |
| `leave_my_team` | `` | `jsonb` | SECURITY DEFINER | Removes the caller from the current team subject to captain rules. |
| `list_scrims` | `` | `jsonb` | invoker | Public read model for recent non-cancelled scrims. |
| `recalculate_my_profile_completion` | `` | `integer` | SECURITY DEFINER | Recalculates the current user's onboarding completion. |
| `register_my_team_tournament` | `p_slug text` | `jsonb` | SECURITY DEFINER | Registers the caller's team after full server-side eligibility validation. |
| `register_my_tournament` | `p_slug text` | `jsonb` | SECURITY DEFINER | Registers the caller into a solo tournament. |
| `remove_my_team_member` | `p_handle text` | `jsonb` | SECURITY DEFINER | Captain removes a member from the current team. |
| `report_my_scrim_result` | `p_scrim uuid, p_score_team integer, p_score_opponent integer` | `jsonb` | SECURITY DEFINER | Stores a valid practice result without touching official ledgers. |
| `respond_my_match_result` | `p_match uuid, p_confirm boolean, p_note text` | `jsonb` | SECURITY DEFINER | Opponent confirms or disputes a pending official result claim. |
| `respond_my_team_invite` | `p_invite_id uuid, p_accept boolean` | `jsonb` | SECURITY DEFINER | Accepts/declines a team invite. |
| `respond_scrim_challenge` | `p_challenge uuid, p_accept boolean` | `jsonb` | SECURITY DEFINER | Host captain accepts/declines a scrim challenge. |
| `search_my_team_candidates` | `p_query text, p_limit integer` | `jsonb` | SECURITY DEFINER | Searches recruitable profiles for Team HQ. |
| `set_updated_at` | `` | `trigger` | invoker | Generic BEFORE UPDATE trigger function. |
| `split_standings` | `p_split uuid` | `TABLE(team_id uuid, team_slug text, team_name text, team_tag text, logo_url text, division_code text, points integer, wins integer, losses integer, tournaments_played integer, qualification_status text, qualified_from text, qualification_position integer)` | invoker | Returns qualifier-only aggregate standings for one Semi-Split. |
| `staff_correct_match_result` | `p_match uuid, p_score_a integer, p_score_b integer, p_note text` | `jsonb` | SECURITY DEFINER | Audited safe correction of a completed match result. |
| `staff_create_bracket` | `p_tournament uuid, p_seeds jsonb, p_matches jsonb` | `jsonb` | SECURITY DEFINER | Staff RPC for creating a validated tournament bracket. |
| `staff_dismiss_match_dispute` | `p_claim uuid, p_note text` | `jsonb` | SECURITY DEFINER | Dismisses a result dispute/claim with staff note. |
| `staff_finalize_tournament` | `p_tournament uuid` | `jsonb` | SECURITY DEFINER | Finalizes placements, points and qualification effects idempotently. |
| `staff_generate_split_playoffs` | `p_split uuid, p_best_of integer, p_allow_short_field boolean, p_reason text` | `jsonb` | SECURITY DEFINER | Builds the Semi-Split playoff tournament, entries, snapshots and bracket. |
| `staff_get_split_ops` | `p_split uuid` | `jsonb` | SECURITY DEFINER | Returns staff operational state for a Semi-Split. |
| `staff_list_match_disputes` | `` | `jsonb` | SECURITY DEFINER | Returns the active staff dispute queue. |
| `staff_list_support_requests` | `` | `jsonb` | SECURITY DEFINER | Returns support queue for staff. |
| `staff_lock_tournament_entries` | `p_tournament uuid` | `jsonb` | SECURITY DEFINER | Locks valid entries and snapshots competition rosters. |
| `staff_record_match_walkover` | `p_match uuid, p_winner_entry uuid, p_note text` | `jsonb` | SECURITY DEFINER | Records an audited walkover; advances winner and counts a match win. |
| `staff_replace_withdrawn_qualifier` | `p_split uuid, p_team uuid` | `jsonb` | SECURITY DEFINER | Replaces a withdrawn qualified team using eligible standings order. |
| `staff_report_match_result` | `p_match uuid, p_score_a integer, p_score_b integer` | `jsonb` | SECURITY DEFINER | Staff path for applying a validated match score. |
| `staff_resolve_match_dispute` | `p_claim uuid, p_score_a integer, p_score_b integer, p_note text` | `jsonb` | SECURITY DEFINER | Resolves a disputed claim with an official score and note. |
| `staff_set_player_eligibility` | `p_profile uuid, p_status eligibility_status, p_reason text` | `jsonb` | SECURITY DEFINER | Sets eligibility state with review history. |
| `staff_set_split_status` | `p_split uuid, p_status text` | `jsonb` | SECURITY DEFINER | Advances/cancels a Semi-Split through validated transitions. |
| `staff_update_support_request` | `p_request uuid, p_status text, p_response text` | `jsonb` | SECURITY DEFINER | Changes support request state/response. |
| `submit_my_match_result` | `p_match uuid, p_score_a integer, p_score_b integer, p_evidence_url text, p_note text` | `jsonb` | SECURITY DEFINER | Participant/captain submits a score claim and optional evidence. |
| `submit_my_support_request` | `p_category text, p_subject text, p_message text` | `jsonb` | SECURITY DEFINER | Creates a validated support/privacy/account-deletion request. |
| `transfer_my_team_captain` | `p_handle text` | `jsonb` | SECURITY DEFINER | Transfers captainship to an existing member. |
| `update_my_location` | `p_city_id uuid` | `jsonb` | SECURITY DEFINER | Sets the caller location and derived geographic hierarchy. |
| `update_my_team` | `p_name text, p_tag text, p_bio text` | `jsonb` | SECURITY DEFINER | Updates team public identity fields. |
| `update_my_team_member_lane_role` | `p_handle text, p_lane_role text` | `jsonb` | SECURITY DEFINER | Captain assigns/removes a starter lane role. |
| `update_my_team_member_role` | `p_handle text, p_role text` | `jsonb` | SECURITY DEFINER | Captain changes starter/substitute membership role. |

### Runtime configuration / grants

- `archive_my_team()`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `cancel_my_scrim(p_scrim uuid)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `cancel_my_team_invite(p_invite_id uuid)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `challenge_scrim(p_scrim uuid)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `check_in_my_team_tournament(p_slug text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `check_in_my_tournament(p_slug text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `create_my_scrim(p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_best_of integer, p_note text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `create_my_team(p_name text, p_tag text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `ensure_my_profile()`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `get_my_match_result(p_match uuid)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `get_my_scrim_hub()`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `get_my_support_requests()`: language `sql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `get_my_team_hub()`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `get_my_tournament_entry(p_slug text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `invite_my_team_member(p_handle text, p_role text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `leave_my_team()`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `list_scrims()`: language `sql`; config `search_path=""`; ACL `postgres=X/postgres; anon=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `recalculate_my_profile_completion()`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `register_my_team_tournament(p_slug text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `register_my_tournament(p_slug text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `remove_my_team_member(p_handle text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `report_my_scrim_result(p_scrim uuid, p_score_team integer, p_score_opponent integer)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `respond_my_match_result(p_match uuid, p_confirm boolean, p_note text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `respond_my_team_invite(p_invite_id uuid, p_accept boolean)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `respond_scrim_challenge(p_challenge uuid, p_accept boolean)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `search_my_team_candidates(p_query text, p_limit integer)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `set_updated_at()`: language `plpgsql`; config `search_path=public`; ACL `=X/postgres; postgres=X/postgres; anon=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `split_standings(p_split uuid)`: language `sql`; config `search_path=public`; ACL `postgres=X/postgres; anon=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `staff_correct_match_result(p_match uuid, p_score_a integer, p_score_b integer, p_note text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `staff_create_bracket(p_tournament uuid, p_seeds jsonb, p_matches jsonb)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `staff_dismiss_match_dispute(p_claim uuid, p_note text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `staff_finalize_tournament(p_tournament uuid)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `staff_generate_split_playoffs(p_split uuid, p_best_of integer, p_allow_short_field boolean, p_reason text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `staff_get_split_ops(p_split uuid)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `staff_list_match_disputes()`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `staff_list_support_requests()`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `staff_lock_tournament_entries(p_tournament uuid)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `staff_record_match_walkover(p_match uuid, p_winner_entry uuid, p_note text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `staff_replace_withdrawn_qualifier(p_split uuid, p_team uuid)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `staff_report_match_result(p_match uuid, p_score_a integer, p_score_b integer)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `staff_resolve_match_dispute(p_claim uuid, p_score_a integer, p_score_b integer, p_note text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `staff_set_player_eligibility(p_profile uuid, p_status eligibility_status, p_reason text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `staff_set_split_status(p_split uuid, p_status text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `staff_update_support_request(p_request uuid, p_status text, p_response text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `submit_my_match_result(p_match uuid, p_score_a integer, p_score_b integer, p_evidence_url text, p_note text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `submit_my_support_request(p_category text, p_subject text, p_message text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `transfer_my_team_captain(p_handle text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `update_my_location(p_city_id uuid)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `update_my_team(p_name text, p_tag text, p_bio text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `update_my_team_member_lane_role(p_handle text, p_lane_role text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.
- `update_my_team_member_role(p_handle text, p_role text)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; authenticated=X/postgres; service_role=X/postgres`.

## private schema

| Function | Arguments | Returns | Security | Purpose |
| --- | --- | --- | --- | --- |
| `actor_is_staff` | `p_actor uuid` | `boolean` | SECURITY DEFINER | Checks whether a supplied authenticated actor has staff authority. |
| `apply_match_result_core` | `p_actor uuid, p_match uuid, p_score_a integer, p_score_b integer, p_audit_action text` | `jsonb` | SECURITY DEFINER | Trusted internal result application/advancement primitive. |
| `assign_qualification_slots` | `p_actor uuid, p_split uuid, p_tournament uuid` | `jsonb` | SECURITY DEFINER | Allocates qualifier slots with pass-down and concurrency protection. |
| `audit` | `p_actor uuid, p_action text, p_entity_type text, p_entity_id uuid, p_metadata jsonb` | `void` | SECURITY DEFINER | Writes competition audit log metadata. |
| `award_entry` | `p_entry uuid, p_rule text, p_points integer, p_event_key text, p_note text` | `void` | SECURITY DEFINER | Idempotently awards configured points to an entry/player/team ledger. |
| `bracket_entry_ids` | `p_tournament uuid` | `SETOF uuid` | SECURITY DEFINER | Returns entries participating in a generated bracket. |
| `correct_completed_match_result` | `p_actor uuid, p_match uuid, p_score_a integer, p_score_b integer, p_note text` | `jsonb` | SECURITY DEFINER | Trusted safe correction engine with downstream-activity protection. |
| `create_bracket` | `p_actor uuid, p_tournament uuid, p_seeds jsonb, p_matches jsonb` | `jsonb` | SECURITY DEFINER | Creates validated match rows for an already-locked tournament. |
| `entry_competed` | `p_entry uuid` | `boolean` | SECURITY DEFINER | Determines whether an entry actually competed for scoring/finalization. |
| `finalize_tournament` | `p_actor uuid, p_tournament uuid` | `jsonb` | SECURITY DEFINER | Trusted finalization/scoring/qualification engine. |
| `generate_split_playoffs` | `p_actor uuid, p_split uuid, p_best_of integer, p_allow_short_field boolean, p_reason text` | `jsonb` | SECURITY DEFINER | Atomically creates seeded Semi-Split playoffs. |
| `handle_new_auth_user` | `` | `trigger` | SECURITY DEFINER | Auth trigger path that provisions new user profile/role. |
| `has_role` | `_role app_role` | `boolean` | SECURITY DEFINER | Checks auth.uid() for a specific application role. |
| `is_staff` | `` | `boolean` | SECURITY DEFINER | Checks auth.uid() for admin/moderator role. |
| `lock_tournament_entries` | `p_actor uuid, p_tournament uuid` | `jsonb` | SECURITY DEFINER | Trusted lock/snapshot engine. |
| `match_entry_for_profile` | `p_match uuid, p_profile uuid` | `uuid` | SECURITY DEFINER | Finds which side/entry a profile represents in a match. |
| `match_score_valid` | `p_match uuid, p_score_a integer, p_score_b integer` | `boolean` | SECURITY DEFINER | Validates a score against the match best-of. |
| `normalize_match_resolution` | `` | `trigger` | invoker | Normalizes result metadata before match write. |
| `player_eligibility_reasons` | `p_profile uuid, p_tournament uuid` | `text[]` | SECURITY DEFINER | Returns machine-readable reasons a player cannot enter a tournament. |
| `provision_profile` | `_user_id uuid, _email text, _meta jsonb` | `uuid` | SECURITY DEFINER | Trusted profile provisioning helper. |
| `recalculate_profile_completion` | `p_profile uuid` | `integer` | SECURITY DEFINER | Recomputes onboarding completeness. |
| `recompute_profile_stats` | `p_profile uuid` | `void` | SECURITY DEFINER | Rebuilds cached player totals from authoritative ledgers/results. |
| `recompute_team_stats` | `p_team uuid` | `void` | SECURITY DEFINER | Rebuilds cached team totals from authoritative ledgers/results. |
| `record_legal_acceptance` | `` | `trigger` | SECURITY DEFINER | Persists current legal document versions for auth user. |
| `record_match_walkover` | `p_actor uuid, p_match uuid, p_winner_entry uuid, p_note text` | `jsonb` | SECURITY DEFINER | Trusted audited walkover engine. |
| `replace_withdrawn_qualifier` | `p_actor uuid, p_split uuid, p_team uuid` | `jsonb` | SECURITY DEFINER | Trusted qualified-team replacement engine. |
| `report_match_result` | `p_actor uuid, p_match uuid, p_score_a integer, p_score_b integer` | `jsonb` | SECURITY DEFINER | Trusted normal result application path. |
| `require_current_legal_acceptance` | `` | `trigger` | SECURITY DEFINER | Rejects flows requiring stale/missing Terms/Privacy acceptance. |
| `resolve_location` | `_city_id uuid` | `TABLE(city_id uuid, province_id uuid, country_id uuid, region_id uuid)` | SECURITY DEFINER | Resolves city into province/country/region hierarchy. |
| `roster_snapshot_immutable` | `` | `trigger` | SECURITY DEFINER | Trigger guard preventing locked roster mutation. |
| `round_label` | `p_round_index integer, p_rounds integer` | `text` | invoker | Converts bracket round coordinates to a display label. |
| `seed_order` | `p_size integer` | `integer[]` | invoker | Produces standard single-elimination seed ordering. |
| `set_split_status` | `p_actor uuid, p_split uuid, p_status text` | `jsonb` | SECURITY DEFINER | Trusted Semi-Split transition engine. |
| `snapshot_entry_roster` | `p_entry uuid` | `integer` | SECURITY DEFINER | Copies a team roster into immutable tournament snapshot rows. |
| `team_eligibility` | `p_team uuid, p_tournament uuid, p_entry uuid` | `jsonb` | SECURITY DEFINER | Returns team/tournament eligibility result and reasons. |
| `team_is_eligible` | `p_team uuid` | `boolean` | SECURITY DEFINER | Boolean helper for team eligibility/replacement selection. |
| `team_is_eligible` | `p_team uuid, p_tournament uuid` | `boolean` | SECURITY DEFINER | Boolean helper for team eligibility/replacement selection. |
| `unique_player_handle` | `_user_id uuid` | `text` | SECURITY DEFINER | Generates a collision-safe profile handle. |

### Runtime configuration / grants

- `actor_is_staff(p_actor uuid)`: language `sql`; config `search_path=public, private`; ACL `postgres=X/postgres; service_role=X/postgres`.
- `apply_match_result_core(p_actor uuid, p_match uuid, p_score_a integer, p_score_b integer, p_audit_action text)`: language `plpgsql`; config `search_path=public, private`; ACL `postgres=X/postgres`.
- `assign_qualification_slots(p_actor uuid, p_split uuid, p_tournament uuid)`: language `plpgsql`; config `search_path=public, private`; ACL `postgres=X/postgres; service_role=X/postgres`.
- `audit(p_actor uuid, p_action text, p_entity_type text, p_entity_id uuid, p_metadata jsonb)`: language `sql`; config `search_path=public, private`; ACL `postgres=X/postgres; service_role=X/postgres`.
- `award_entry(p_entry uuid, p_rule text, p_points integer, p_event_key text, p_note text)`: language `plpgsql`; config `search_path=public, private`; ACL `postgres=X/postgres; service_role=X/postgres`.
- `bracket_entry_ids(p_tournament uuid)`: language `sql`; config `search_path=public, private`; ACL `postgres=X/postgres`.
- `correct_completed_match_result(p_actor uuid, p_match uuid, p_score_a integer, p_score_b integer, p_note text)`: language `plpgsql`; config `search_path=public, private`; ACL `postgres=X/postgres`.
- `create_bracket(p_actor uuid, p_tournament uuid, p_seeds jsonb, p_matches jsonb)`: language `plpgsql`; config `search_path=public, private`; ACL `postgres=X/postgres; service_role=X/postgres`.
- `entry_competed(p_entry uuid)`: language `sql`; config `search_path=public, private`; ACL `postgres=X/postgres`.
- `finalize_tournament(p_actor uuid, p_tournament uuid)`: language `plpgsql`; config `search_path=public, private`; ACL `postgres=X/postgres; service_role=X/postgres`.
- `generate_split_playoffs(p_actor uuid, p_split uuid, p_best_of integer, p_allow_short_field boolean, p_reason text)`: language `plpgsql`; config `search_path=public, private`; ACL `postgres=X/postgres`.
- `handle_new_auth_user()`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; service_role=X/postgres`.
- `has_role(_role app_role)`: language `sql`; config `search_path=""`; ACL `postgres=X/postgres; service_role=X/postgres; authenticated=X/postgres`.
- `is_staff()`: language `sql`; config `search_path=""`; ACL `postgres=X/postgres; service_role=X/postgres; authenticated=X/postgres`.
- `lock_tournament_entries(p_actor uuid, p_tournament uuid)`: language `plpgsql`; config `search_path=public, private`; ACL `postgres=X/postgres; service_role=X/postgres`.
- `match_entry_for_profile(p_match uuid, p_profile uuid)`: language `sql`; config `search_path=public, private`; ACL `postgres=X/postgres`.
- `match_score_valid(p_match uuid, p_score_a integer, p_score_b integer)`: language `sql`; config `search_path=public`; ACL `postgres=X/postgres`.
- `normalize_match_resolution()`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres`.
- `player_eligibility_reasons(p_profile uuid, p_tournament uuid)`: language `plpgsql`; config `search_path=public, private`; ACL `postgres=X/postgres`.
- `provision_profile(_user_id uuid, _email text, _meta jsonb)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; service_role=X/postgres`.
- `recalculate_profile_completion(p_profile uuid)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; service_role=X/postgres`.
- `recompute_profile_stats(p_profile uuid)`: language `plpgsql`; config `search_path=public, private`; ACL `postgres=X/postgres; service_role=X/postgres`.
- `recompute_team_stats(p_team uuid)`: language `plpgsql`; config `search_path=public, private`; ACL `postgres=X/postgres; service_role=X/postgres`.
- `record_legal_acceptance()`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres`.
- `record_match_walkover(p_actor uuid, p_match uuid, p_winner_entry uuid, p_note text)`: language `plpgsql`; config `search_path=public, private`; ACL `postgres=X/postgres`.
- `replace_withdrawn_qualifier(p_actor uuid, p_split uuid, p_team uuid)`: language `plpgsql`; config `search_path=public, private`; ACL `postgres=X/postgres; service_role=X/postgres`.
- `report_match_result(p_actor uuid, p_match uuid, p_score_a integer, p_score_b integer)`: language `plpgsql`; config `search_path=public, private`; ACL `postgres=X/postgres; service_role=X/postgres`.
- `require_current_legal_acceptance()`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres`.
- `resolve_location(_city_id uuid)`: language `sql`; config `search_path=""`; ACL `postgres=X/postgres; service_role=X/postgres`.
- `roster_snapshot_immutable()`: language `plpgsql`; config `search_path=public, private`; ACL `postgres=X/postgres`.
- `round_label(p_round_index integer, p_rounds integer)`: language `sql`; config `search_path=public`; ACL `postgres=X/postgres`.
- `seed_order(p_size integer)`: language `plpgsql`; config `search_path=public`; ACL `postgres=X/postgres`.
- `set_split_status(p_actor uuid, p_split uuid, p_status text)`: language `plpgsql`; config `search_path=public, private`; ACL `postgres=X/postgres; service_role=X/postgres`.
- `snapshot_entry_roster(p_entry uuid)`: language `plpgsql`; config `search_path=public, private`; ACL `postgres=X/postgres`.
- `team_eligibility(p_team uuid, p_tournament uuid, p_entry uuid)`: language `plpgsql`; config `search_path=public, private`; ACL `postgres=X/postgres`.
- `team_is_eligible(p_team uuid)`: language `sql`; config `search_path=public, private`; ACL `postgres=X/postgres; service_role=X/postgres`.
- `team_is_eligible(p_team uuid, p_tournament uuid)`: language `sql`; config `search_path=public, private`; ACL `postgres=X/postgres`.
- `unique_player_handle(_user_id uuid)`: language `plpgsql`; config `search_path=""`; ACL `postgres=X/postgres; service_role=X/postgres`.

## Change rule

Before changing a function, locate its latest `CREATE OR REPLACE FUNCTION` in `supabase/migrations/`, understand all callers, add a forward migration, run the security and competition SQL suites, and update the domain documentation.
