# EloShape staging schema reference

Generated from the live **staging** Postgres catalog on 2026-09-22. This is a field-level reference; [DATABASE.md](./DATABASE.md) explains the model and relationships conceptually.

> Do not copy data values from staging into production. This document describes schema metadata only.

## Legend

- **Nullable**: whether SQL NULL is accepted.
- **Default**: database default; “—” means no default.
- RLS/policies shown here are the policies that exist in the staging catalog at generation time.

## `achievements`

Player achievement records.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `profile_id` | `uuid` | no | `—` |
| `code` | `text` | no | `—` |
| `title` | `text` | no | `—` |
| `description` | `text` | yes | `—` |
| `tier` | `text` | no | `'bronze'::text` |
| `earned_at` | `timestamp with time zone` | no | `now()` |

### Constraints

- **CHECK** `2200_17937_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_17937_2_not_null` — `profile_id IS NOT NULL`
- **CHECK** `2200_17937_3_not_null` — `code IS NOT NULL`
- **CHECK** `2200_17937_4_not_null` — `title IS NOT NULL`
- **CHECK** `2200_17937_6_not_null` — `tier IS NOT NULL`
- **CHECK** `2200_17937_7_not_null` — `earned_at IS NOT NULL`
- **FOREIGN KEY** `achievements_profile_id_fkey` on `profile_id` → `profiles(id)`
- **PRIMARY KEY** `achievements_pkey` on `id`

### Indexes

- `achievements_pkey` — `CREATE UNIQUE INDEX achievements_pkey ON public.achievements USING btree (id)`
- `achievements_profile_id_idx` — `CREATE INDEX achievements_profile_id_idx ON public.achievements USING btree (profile_id)`

### RLS policies

- `achievements public read` — command **SELECT**, roles `{public}`, USING `true`.

## `competition_audit_log`

Immutable-style audit trail for privileged competition operations.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `actor_user_id` | `uuid` | yes | `—` |
| `action` | `text` | no | `—` |
| `entity_type` | `text` | no | `—` |
| `entity_id` | `uuid` | yes | `—` |
| `metadata` | `jsonb` | no | `'{}'::jsonb` |
| `created_at` | `timestamp with time zone` | no | `now()` |

### Constraints

- **CHECK** `2200_18164_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_18164_3_not_null` — `action IS NOT NULL`
- **CHECK** `2200_18164_4_not_null` — `entity_type IS NOT NULL`
- **CHECK** `2200_18164_6_not_null` — `metadata IS NOT NULL`
- **CHECK** `2200_18164_7_not_null` — `created_at IS NOT NULL`
- **PRIMARY KEY** `competition_audit_log_pkey` on `id`

### Indexes

- `competition_audit_log_pkey` — `CREATE UNIQUE INDEX competition_audit_log_pkey ON public.competition_audit_log USING btree (id)`

### RLS policies

- `Staff read audit log` — command **SELECT**, roles `{authenticated}`, USING `private.is_staff()`.

## `competitive_splits`

Semi-Split configuration and lifecycle.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `season_id` | `uuid` | no | `—` |
| `slug` | `text` | no | `—` |
| `name` | `text` | no | `—` |
| `division_id` | `uuid` | yes | `—` |
| `region_id` | `uuid` | yes | `—` |
| `starts_at` | `timestamp with time zone` | no | `—` |
| `ends_at` | `timestamp with time zone` | no | `—` |
| `status` | `split_status` | no | `'upcoming'::split_status` |
| `playoff_size` | `integer` | no | `16` |
| `dispute_deadline_at` | `timestamp with time zone` | yes | `—` |
| `playoff_reveal_at` | `timestamp with time zone` | yes | `—` |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `updated_at` | `timestamp with time zone` | no | `now()` |
| `qualification_slots_per_qualifier` | `integer` | no | `4` |

### Constraints

- **CHECK** `2200_18055_10_not_null` — `playoff_size IS NOT NULL`
- **CHECK** `2200_18055_13_not_null` — `created_at IS NOT NULL`
- **CHECK** `2200_18055_14_not_null` — `updated_at IS NOT NULL`
- **CHECK** `2200_18055_15_not_null` — `qualification_slots_per_qualifier IS NOT NULL`
- **CHECK** `2200_18055_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_18055_2_not_null` — `season_id IS NOT NULL`
- **CHECK** `2200_18055_3_not_null` — `slug IS NOT NULL`
- **CHECK** `2200_18055_4_not_null` — `name IS NOT NULL`
- **CHECK** `2200_18055_7_not_null` — `starts_at IS NOT NULL`
- **CHECK** `2200_18055_8_not_null` — `ends_at IS NOT NULL`
- **CHECK** `2200_18055_9_not_null` — `status IS NOT NULL`
- **FOREIGN KEY** `competitive_splits_division_id_fkey` on `division_id` → `divisions(id)`
- **FOREIGN KEY** `competitive_splits_region_id_fkey` on `region_id` → `regions(id)`
- **FOREIGN KEY** `competitive_splits_season_id_fkey` on `season_id` → `seasons(id)`
- **PRIMARY KEY** `competitive_splits_pkey` on `id`
- **UNIQUE** `competitive_splits_slug_key` on `slug`

### Indexes

- `competitive_splits_division_id_idx` — `CREATE INDEX competitive_splits_division_id_idx ON public.competitive_splits USING btree (division_id)`
- `competitive_splits_pkey` — `CREATE UNIQUE INDEX competitive_splits_pkey ON public.competitive_splits USING btree (id)`
- `competitive_splits_region_id_idx` — `CREATE INDEX competitive_splits_region_id_idx ON public.competitive_splits USING btree (region_id)`
- `competitive_splits_season_id_idx` — `CREATE INDEX competitive_splits_season_id_idx ON public.competitive_splits USING btree (season_id)`
- `competitive_splits_slug_key` — `CREATE UNIQUE INDEX competitive_splits_slug_key ON public.competitive_splits USING btree (slug)`

### RLS policies

- `Splits are public` — command **SELECT**, roles `{public}`, USING `true`.

### Triggers

- `competitive_splits_updated_at` — BEFORE UPDATE; `EXECUTE FUNCTION set_updated_at()`

## `divisions`

EloShape divisions and Riot tier mapping.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `code` | `text` | no | `—` |
| `name` | `text` | no | `—` |
| `sort_order` | `integer` | no | `0` |
| `riot_tiers` | `ARRAY` | no | `'{}'::text[]` |
| `accent` | `text` | no | `'silver'::text` |
| `description` | `text` | yes | `—` |
| `created_at` | `timestamp with time zone` | no | `now()` |

### Constraints

- **CHECK** `2200_17591_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_17591_2_not_null` — `code IS NOT NULL`
- **CHECK** `2200_17591_3_not_null` — `name IS NOT NULL`
- **CHECK** `2200_17591_4_not_null` — `sort_order IS NOT NULL`
- **CHECK** `2200_17591_5_not_null` — `riot_tiers IS NOT NULL`
- **CHECK** `2200_17591_6_not_null` — `accent IS NOT NULL`
- **CHECK** `2200_17591_8_not_null` — `created_at IS NOT NULL`
- **PRIMARY KEY** `divisions_pkey` on `id`
- **UNIQUE** `divisions_code_key` on `code`

### Indexes

- `divisions_code_key` — `CREATE UNIQUE INDEX divisions_code_key ON public.divisions USING btree (code)`
- `divisions_pkey` — `CREATE UNIQUE INDEX divisions_pkey ON public.divisions USING btree (id)`

### RLS policies

- `divisions public read` — command **SELECT**, roles `{public}`, USING `true`.

## `eligibility_reviews`

Manual anti-smurf/eligibility review history.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `profile_id` | `uuid` | no | `—` |
| `status` | `eligibility_status` | no | `'pending_review'::eligibility_status` |
| `reason` | `text` | yes | `—` |
| `notes` | `text` | yes | `—` |
| `reviewed_by` | `uuid` | yes | `—` |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `updated_at` | `timestamp with time zone` | no | `now()` |

### Constraints

- **CHECK** `2200_17981_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_17981_2_not_null` — `profile_id IS NOT NULL`
- **CHECK** `2200_17981_3_not_null` — `status IS NOT NULL`
- **CHECK** `2200_17981_7_not_null` — `created_at IS NOT NULL`
- **CHECK** `2200_17981_8_not_null` — `updated_at IS NOT NULL`
- **FOREIGN KEY** `eligibility_reviews_profile_id_fkey` on `profile_id` → `profiles(id)`
- **PRIMARY KEY** `eligibility_reviews_pkey` on `id`

### Indexes

- `eligibility_reviews_pkey` — `CREATE UNIQUE INDEX eligibility_reviews_pkey ON public.eligibility_reviews USING btree (id)`
- `eligibility_reviews_profile_id_idx` — `CREATE INDEX eligibility_reviews_profile_id_idx ON public.eligibility_reviews USING btree (profile_id)`

### RLS policies

- `eligibility staff read` — command **SELECT**, roles `{authenticated}`, USING `(private.is_staff() OR (EXISTS ( SELECT 1    FROM profiles p   WHERE ((p.id = eligibility_reviews.profile_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))`.
- `eligibility staff write` — command **ALL**, roles `{authenticated}`, USING `private.is_staff()`, WITH CHECK `private.is_staff()`.

### Triggers

- `eligibility_updated_at` — BEFORE UPDATE; `EXECUTE FUNCTION set_updated_at()`

## `legal_acceptances`

Versioned Terms/Privacy acceptance.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `user_id` | `uuid` | no | `—` |
| `terms_version` | `text` | no | `—` |
| `privacy_version` | `text` | no | `—` |
| `accepted_at` | `timestamp with time zone` | no | `now()` |

### Constraints

- **CHECK** `2200_18365_1_not_null` — `user_id IS NOT NULL`
- **CHECK** `2200_18365_2_not_null` — `terms_version IS NOT NULL`
- **CHECK** `2200_18365_3_not_null` — `privacy_version IS NOT NULL`
- **CHECK** `2200_18365_4_not_null` — `accepted_at IS NOT NULL`
- **FOREIGN KEY** `legal_acceptances_user_id_fkey` on `user_id` → `—(—)`
- **PRIMARY KEY** `legal_acceptances_pkey` on `user_id`

### Indexes

- `legal_acceptances_pkey` — `CREATE UNIQUE INDEX legal_acceptances_pkey ON public.legal_acceptances USING btree (user_id)`

### RLS policies

- `legal acceptance read own` — command **SELECT**, roles `{authenticated}`, USING `(user_id = ( SELECT auth.uid() AS uid))`.

## `match_players`

Per-match player association/statistics.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `match_id` | `uuid` | no | `—` |
| `profile_id` | `uuid` | no | `—` |
| `side` | `text` | no | `'a'::text` |
| `champion` | `text` | yes | `—` |
| `kills` | `integer` | no | `0` |
| `deaths` | `integer` | no | `0` |
| `assists` | `integer` | no | `0` |
| `is_win` | `boolean` | no | `false` |
| `created_at` | `timestamp with time zone` | no | `now()` |

### Constraints

- **CHECK** `2200_17881_10_not_null` — `created_at IS NOT NULL`
- **CHECK** `2200_17881_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_17881_2_not_null` — `match_id IS NOT NULL`
- **CHECK** `2200_17881_3_not_null` — `profile_id IS NOT NULL`
- **CHECK** `2200_17881_4_not_null` — `side IS NOT NULL`
- **CHECK** `2200_17881_6_not_null` — `kills IS NOT NULL`
- **CHECK** `2200_17881_7_not_null` — `deaths IS NOT NULL`
- **CHECK** `2200_17881_8_not_null` — `assists IS NOT NULL`
- **CHECK** `2200_17881_9_not_null` — `is_win IS NOT NULL`
- **FOREIGN KEY** `match_players_match_id_fkey` on `match_id` → `matches(id)`
- **FOREIGN KEY** `match_players_profile_id_fkey` on `profile_id` → `profiles(id)`
- **PRIMARY KEY** `match_players_pkey` on `id`

### Indexes

- `match_players_match_id_idx` — `CREATE INDEX match_players_match_id_idx ON public.match_players USING btree (match_id)`
- `match_players_pkey` — `CREATE UNIQUE INDEX match_players_pkey ON public.match_players USING btree (id)`
- `match_players_profile_id_idx` — `CREATE INDEX match_players_profile_id_idx ON public.match_players USING btree (profile_id)`

### RLS policies

- `match players public read` — command **SELECT**, roles `{public}`, USING `true`.

## `match_result_claims`

Participant score submission, confirmation/dispute and staff resolution.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `match_id` | `uuid` | no | `—` |
| `reporter_profile_id` | `uuid` | no | `—` |
| `reporter_entry_id` | `uuid` | no | `—` |
| `score_a` | `integer` | no | `—` |
| `score_b` | `integer` | no | `—` |
| `evidence_url` | `text` | yes | `—` |
| `reporter_note` | `text` | yes | `—` |
| `status` | `text` | no | `'pending_confirmation'::text` |
| `responder_profile_id` | `uuid` | yes | `—` |
| `responder_note` | `text` | yes | `—` |
| `responded_at` | `timestamp with time zone` | yes | `—` |
| `resolved_by_user_id` | `uuid` | yes | `—` |
| `resolution_note` | `text` | yes | `—` |
| `resolved_at` | `timestamp with time zone` | yes | `—` |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `updated_at` | `timestamp with time zone` | no | `now()` |

### Constraints

- **CHECK** `2200_18383_16_not_null` — `created_at IS NOT NULL`
- **CHECK** `2200_18383_17_not_null` — `updated_at IS NOT NULL`
- **CHECK** `2200_18383_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_18383_2_not_null` — `match_id IS NOT NULL`
- **CHECK** `2200_18383_3_not_null` — `reporter_profile_id IS NOT NULL`
- **CHECK** `2200_18383_4_not_null` — `reporter_entry_id IS NOT NULL`
- **CHECK** `2200_18383_5_not_null` — `score_a IS NOT NULL`
- **CHECK** `2200_18383_6_not_null` — `score_b IS NOT NULL`
- **CHECK** `2200_18383_9_not_null` — `status IS NOT NULL`
- **CHECK** `match_result_claims_status_check` — `(status = ANY (ARRAY['pending_confirmation'::text, 'disputed'::text, 'confirmed'::text, 'resolved'::text, 'dismissed'::text]))`
- **FOREIGN KEY** `match_result_claims_match_id_fkey` on `match_id` → `matches(id)`
- **FOREIGN KEY** `match_result_claims_reporter_entry_id_fkey` on `reporter_entry_id` → `tournament_entries(id)`
- **FOREIGN KEY** `match_result_claims_reporter_profile_id_fkey` on `reporter_profile_id` → `profiles(id)`
- **FOREIGN KEY** `match_result_claims_resolved_by_user_id_fkey` on `resolved_by_user_id` → `—(—)`
- **FOREIGN KEY** `match_result_claims_responder_profile_id_fkey` on `responder_profile_id` → `profiles(id)`
- **PRIMARY KEY** `match_result_claims_pkey` on `id`
- **UNIQUE** `match_result_claims_match_id_key` on `match_id`

### Indexes

- `match_result_claims_match_id_key` — `CREATE UNIQUE INDEX match_result_claims_match_id_key ON public.match_result_claims USING btree (match_id)`
- `match_result_claims_pkey` — `CREATE UNIQUE INDEX match_result_claims_pkey ON public.match_result_claims USING btree (id)`
- `match_result_claims_reporter_entry_id_idx` — `CREATE INDEX match_result_claims_reporter_entry_id_idx ON public.match_result_claims USING btree (reporter_entry_id)`
- `match_result_claims_reporter_profile_id_idx` — `CREATE INDEX match_result_claims_reporter_profile_id_idx ON public.match_result_claims USING btree (reporter_profile_id)`
- `match_result_claims_resolved_by_user_id_idx` — `CREATE INDEX match_result_claims_resolved_by_user_id_idx ON public.match_result_claims USING btree (resolved_by_user_id)`
- `match_result_claims_responder_profile_id_idx` — `CREATE INDEX match_result_claims_responder_profile_id_idx ON public.match_result_claims USING btree (responder_profile_id)`
- `match_result_claims_status_idx` — `CREATE INDEX match_result_claims_status_idx ON public.match_result_claims USING btree (status, created_at)`

### RLS policies

- `match result claims participant read` — command **SELECT**, roles `{authenticated}`, USING `((EXISTS ( SELECT 1    FROM user_roles ur   WHERE ((ur.user_id = ( SELECT auth.uid() AS uid)) AND (ur.role = ANY (ARRAY['admin'::app_role, 'moderator'::app_role]))))) OR (EXISTS ( SELECT 1    FROM (((profiles me      JOIN matches m ON ((m.id = match_result_claims.match_id)))      LEFT JOIN tournament_entries ea ON ((ea.id = m.entry_a_id)))      LEFT JOIN tournament_entries eb ON ((eb.id = m.entry_b_id)))   WHERE ((me.user_id = ( SELECT auth.uid() AS uid)) AND ((ea.profile_id = me.id) OR (eb.profile_id = me.id) OR (EXISTS ( SELECT 1            FROM tournament_roster_members trm           WHERE ((trm.profile_id = me.id) AND (trm.is_captain = true) AND (trm.entry_id = ANY (ARRAY[m.entry_a_id, m.entry_b_id]))))))))))`.

## `matches`

Official bracket matches and result resolution state.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `tournament_id` | `uuid` | no | `—` |
| `round_label` | `text` | no | `—` |
| `round_index` | `integer` | no | `1` |
| `bracket_slot` | `integer` | no | `1` |
| `best_of` | `integer` | no | `1` |
| `status` | `match_status` | no | `'scheduled'::match_status` |
| `scheduled_at` | `timestamp with time zone` | yes | `—` |
| `entry_a_id` | `uuid` | yes | `—` |
| `entry_b_id` | `uuid` | yes | `—` |
| `score_a` | `integer` | no | `0` |
| `score_b` | `integer` | no | `0` |
| `winner_entry_id` | `uuid` | yes | `—` |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `is_bye` | `boolean` | no | `false` |
| `resolution_type` | `text` | no | `'played'::text` |
| `resolution_note` | `text` | yes | `—` |
| `resolved_by_user_id` | `uuid` | yes | `—` |
| `resolved_at` | `timestamp with time zone` | yes | `—` |

### Constraints

- **CHECK** `2200_17844_11_not_null` — `score_a IS NOT NULL`
- **CHECK** `2200_17844_12_not_null` — `score_b IS NOT NULL`
- **CHECK** `2200_17844_14_not_null` — `created_at IS NOT NULL`
- **CHECK** `2200_17844_15_not_null` — `is_bye IS NOT NULL`
- **CHECK** `2200_17844_16_not_null` — `resolution_type IS NOT NULL`
- **CHECK** `2200_17844_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_17844_2_not_null` — `tournament_id IS NOT NULL`
- **CHECK** `2200_17844_3_not_null` — `round_label IS NOT NULL`
- **CHECK** `2200_17844_4_not_null` — `round_index IS NOT NULL`
- **CHECK** `2200_17844_5_not_null` — `bracket_slot IS NOT NULL`
- **CHECK** `2200_17844_6_not_null` — `best_of IS NOT NULL`
- **CHECK** `2200_17844_7_not_null` — `status IS NOT NULL`
- **CHECK** `matches_resolution_consistency_check` — `(((resolution_type = 'played'::text) AND (NOT is_bye)) OR ((resolution_type = ANY (ARRAY['bye'::text, 'walkover'::text])) AND is_bye))`
- **CHECK** `matches_resolution_type_check` — `(resolution_type = ANY (ARRAY['played'::text, 'bye'::text, 'walkover'::text]))`
- **CHECK** `matches_walkover_note_check` — `((resolution_type <> 'walkover'::text) OR ((length(TRIM(BOTH FROM COALESCE(resolution_note, ''::text))) >= 3) AND (length(TRIM(BOTH FROM COALESCE(resolution_note, ''::text))) <= 1000)))`
- **FOREIGN KEY** `matches_entry_a_id_fkey` on `entry_a_id` → `tournament_entries(id)`
- **FOREIGN KEY** `matches_entry_b_id_fkey` on `entry_b_id` → `tournament_entries(id)`
- **FOREIGN KEY** `matches_tournament_id_fkey` on `tournament_id` → `tournaments(id)`
- **FOREIGN KEY** `matches_winner_entry_id_fkey` on `winner_entry_id` → `tournament_entries(id)`
- **PRIMARY KEY** `matches_pkey` on `id`
- **UNIQUE** `matches_coordinate_unique` on `tournament_id, tournament_id, tournament_id, round_index, round_index, round_index, bracket_slot, bracket_slot, bracket_slot`

### Indexes

- `matches_coordinate_unique` — `CREATE UNIQUE INDEX matches_coordinate_unique ON public.matches USING btree (tournament_id, round_index, bracket_slot)`
- `matches_entry_a_id_idx` — `CREATE INDEX matches_entry_a_id_idx ON public.matches USING btree (entry_a_id)`
- `matches_entry_b_id_idx` — `CREATE INDEX matches_entry_b_id_idx ON public.matches USING btree (entry_b_id)`
- `matches_pkey` — `CREATE UNIQUE INDEX matches_pkey ON public.matches USING btree (id)`
- `matches_winner_entry_id_idx` — `CREATE INDEX matches_winner_entry_id_idx ON public.matches USING btree (winner_entry_id)`

### RLS policies

- `matches admin write` — command **ALL**, roles `{authenticated}`, USING `private.has_role('admin'::app_role)`, WITH CHECK `private.has_role('admin'::app_role)`.
- `matches public read` — command **SELECT**, roles `{public}`, USING `true`.

### Triggers

- `normalize_match_resolution` — BEFORE INSERT, UPDATE; `EXECUTE FUNCTION private.normalize_match_resolution()`

## `point_rules`

Configurable official point values.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `code` | `text` | no | `—` |
| `label` | `text` | no | `—` |
| `points` | `integer` | no | `—` |
| `sort_order` | `integer` | no | `0` |
| `updated_at` | `timestamp with time zone` | no | `now()` |

### Constraints

- **CHECK** `2200_17619_1_not_null` — `code IS NOT NULL`
- **CHECK** `2200_17619_2_not_null` — `label IS NOT NULL`
- **CHECK** `2200_17619_3_not_null` — `points IS NOT NULL`
- **CHECK** `2200_17619_4_not_null` — `sort_order IS NOT NULL`
- **CHECK** `2200_17619_5_not_null` — `updated_at IS NOT NULL`
- **PRIMARY KEY** `point_rules_pkey` on `code`

### Indexes

- `point_rules_pkey` — `CREATE UNIQUE INDEX point_rules_pkey ON public.point_rules USING btree (code)`

### RLS policies

- `point rules public read` — command **SELECT**, roles `{public}`, USING `true`.

## `profiles`

Player public profile plus cached competitive totals.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `user_id` | `uuid` | yes | `—` |
| `handle` | `text` | no | `—` |
| `display_name` | `text` | no | `—` |
| `avatar_url` | `text` | yes | `—` |
| `bio` | `text` | yes | `—` |
| `riot_id` | `text` | yes | `—` |
| `riot_tier` | `text` | yes | `—` |
| `riot_rank` | `text` | yes | `—` |
| `division_id` | `uuid` | yes | `—` |
| `city_id` | `uuid` | yes | `—` |
| `province_id` | `uuid` | yes | `—` |
| `country_id` | `uuid` | yes | `—` |
| `region_id` | `uuid` | yes | `—` |
| `points_season` | `integer` | no | `0` |
| `points_month` | `integer` | no | `0` |
| `wins` | `integer` | no | `0` |
| `losses` | `integer` | no | `0` |
| `rank_movement` | `integer` | no | `0` |
| `tournaments_played` | `integer` | no | `0` |
| `eligibility` | `eligibility_status` | no | `'pending_review'::eligibility_status` |
| `profile_completion` | `integer` | no | `40` |
| `is_demo` | `boolean` | no | `false` |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `updated_at` | `timestamp with time zone` | no | `now()` |

### Constraints

- **CHECK** `2200_17629_15_not_null` — `points_season IS NOT NULL`
- **CHECK** `2200_17629_16_not_null` — `points_month IS NOT NULL`
- **CHECK** `2200_17629_17_not_null` — `wins IS NOT NULL`
- **CHECK** `2200_17629_18_not_null` — `losses IS NOT NULL`
- **CHECK** `2200_17629_19_not_null` — `rank_movement IS NOT NULL`
- **CHECK** `2200_17629_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_17629_20_not_null` — `tournaments_played IS NOT NULL`
- **CHECK** `2200_17629_21_not_null` — `eligibility IS NOT NULL`
- **CHECK** `2200_17629_22_not_null` — `profile_completion IS NOT NULL`
- **CHECK** `2200_17629_23_not_null` — `is_demo IS NOT NULL`
- **CHECK** `2200_17629_24_not_null` — `created_at IS NOT NULL`
- **CHECK** `2200_17629_25_not_null` — `updated_at IS NOT NULL`
- **CHECK** `2200_17629_3_not_null` — `handle IS NOT NULL`
- **CHECK** `2200_17629_4_not_null` — `display_name IS NOT NULL`
- **FOREIGN KEY** `profiles_city_id_fkey` on `city_id` → `regions(id)`
- **FOREIGN KEY** `profiles_country_id_fkey` on `country_id` → `regions(id)`
- **FOREIGN KEY** `profiles_division_id_fkey` on `division_id` → `divisions(id)`
- **FOREIGN KEY** `profiles_province_id_fkey` on `province_id` → `regions(id)`
- **FOREIGN KEY** `profiles_region_id_fkey` on `region_id` → `regions(id)`
- **PRIMARY KEY** `profiles_pkey` on `id`
- **UNIQUE** `profiles_handle_key` on `handle`
- **UNIQUE** `profiles_user_id_key` on `user_id`

### Indexes

- `profiles_city_id_idx` — `CREATE INDEX profiles_city_id_idx ON public.profiles USING btree (city_id)`
- `profiles_country_id_idx` — `CREATE INDEX profiles_country_id_idx ON public.profiles USING btree (country_id)`
- `profiles_division_id_idx` — `CREATE INDEX profiles_division_id_idx ON public.profiles USING btree (division_id)`
- `profiles_handle_key` — `CREATE UNIQUE INDEX profiles_handle_key ON public.profiles USING btree (handle)`
- `profiles_pkey` — `CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id)`
- `profiles_province_id_idx` — `CREATE INDEX profiles_province_id_idx ON public.profiles USING btree (province_id)`
- `profiles_region_id_idx` — `CREATE INDEX profiles_region_id_idx ON public.profiles USING btree (region_id)`
- `profiles_user_id_key` — `CREATE UNIQUE INDEX profiles_user_id_key ON public.profiles USING btree (user_id)`

### RLS policies

- `profiles public read` — command **SELECT**, roles `{public}`, USING `true`.
- `profiles update own` — command **UPDATE**, roles `{authenticated}`, USING `(( SELECT auth.uid() AS uid) = user_id)`, WITH CHECK `(( SELECT auth.uid() AS uid) = user_id)`.

### Triggers

- `profiles_updated_at` — BEFORE UPDATE; `EXECUTE FUNCTION set_updated_at()`

## `ranking_points`

Player points ledger.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `profile_id` | `uuid` | no | `—` |
| `tournament_id` | `uuid` | yes | `—` |
| `season_id` | `uuid` | yes | `—` |
| `rule_code` | `text` | yes | `—` |
| `points` | `integer` | no | `—` |
| `note` | `text` | yes | `—` |
| `awarded_at` | `timestamp with time zone` | no | `now()` |
| `event_key` | `text` | yes | `—` |

### Constraints

- **CHECK** `2200_17906_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_17906_2_not_null` — `profile_id IS NOT NULL`
- **CHECK** `2200_17906_6_not_null` — `points IS NOT NULL`
- **CHECK** `2200_17906_8_not_null` — `awarded_at IS NOT NULL`
- **FOREIGN KEY** `ranking_points_profile_id_fkey` on `profile_id` → `profiles(id)`
- **FOREIGN KEY** `ranking_points_rule_code_fkey` on `rule_code` → `point_rules(code)`
- **FOREIGN KEY** `ranking_points_season_id_fkey` on `season_id` → `seasons(id)`
- **FOREIGN KEY** `ranking_points_tournament_id_fkey` on `tournament_id` → `tournaments(id)`
- **PRIMARY KEY** `ranking_points_pkey` on `id`

### Indexes

- `ranking_points_event_unique` — `CREATE UNIQUE INDEX ranking_points_event_unique ON public.ranking_points USING btree (profile_id, tournament_id, event_key) WHERE ((event_key IS NOT NULL) AND (tournament_id IS NOT NULL))`
- `ranking_points_pkey` — `CREATE UNIQUE INDEX ranking_points_pkey ON public.ranking_points USING btree (id)`
- `ranking_points_rule_code_idx` — `CREATE INDEX ranking_points_rule_code_idx ON public.ranking_points USING btree (rule_code)`
- `ranking_points_season_id_idx` — `CREATE INDEX ranking_points_season_id_idx ON public.ranking_points USING btree (season_id)`
- `ranking_points_tournament_id_idx` — `CREATE INDEX ranking_points_tournament_id_idx ON public.ranking_points USING btree (tournament_id)`

### RLS policies

- `ranking points admin write` — command **ALL**, roles `{authenticated}`, USING `private.has_role('admin'::app_role)`, WITH CHECK `private.has_role('admin'::app_role)`.
- `ranking points public read` — command **SELECT**, roles `{public}`, USING `true`.

## `regions`

Hierarchical geography.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `slug` | `text` | no | `—` |
| `name` | `text` | no | `—` |
| `kind` | `region_kind` | no | `—` |
| `parent_id` | `uuid` | yes | `—` |
| `created_at` | `timestamp with time zone` | no | `now()` |

### Constraints

- **CHECK** `2200_17574_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_17574_2_not_null` — `slug IS NOT NULL`
- **CHECK** `2200_17574_3_not_null` — `name IS NOT NULL`
- **CHECK** `2200_17574_4_not_null` — `kind IS NOT NULL`
- **CHECK** `2200_17574_6_not_null` — `created_at IS NOT NULL`
- **FOREIGN KEY** `regions_parent_id_fkey` on `parent_id` → `regions(id)`
- **PRIMARY KEY** `regions_pkey` on `id`
- **UNIQUE** `regions_slug_key` on `slug`

### Indexes

- `regions_parent_id_idx` — `CREATE INDEX regions_parent_id_idx ON public.regions USING btree (parent_id)`
- `regions_pkey` — `CREATE UNIQUE INDEX regions_pkey ON public.regions USING btree (id)`
- `regions_slug_key` — `CREATE UNIQUE INDEX regions_slug_key ON public.regions USING btree (slug)`

### RLS policies

- `regions public read` — command **SELECT**, roles `{public}`, USING `true`.

## `reports`

Moderation/user reports.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `reporter_profile_id` | `uuid` | yes | `—` |
| `reported_profile_id` | `uuid` | yes | `—` |
| `tournament_id` | `uuid` | yes | `—` |
| `reason` | `text` | no | `—` |
| `details` | `text` | yes | `—` |
| `status` | `report_status` | no | `'open'::report_status` |
| `created_at` | `timestamp with time zone` | no | `now()` |

### Constraints

- **CHECK** `2200_17953_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_17953_5_not_null` — `reason IS NOT NULL`
- **CHECK** `2200_17953_7_not_null` — `status IS NOT NULL`
- **CHECK** `2200_17953_8_not_null` — `created_at IS NOT NULL`
- **FOREIGN KEY** `reports_reported_profile_id_fkey` on `reported_profile_id` → `profiles(id)`
- **FOREIGN KEY** `reports_reporter_profile_id_fkey` on `reporter_profile_id` → `profiles(id)`
- **FOREIGN KEY** `reports_tournament_id_fkey` on `tournament_id` → `tournaments(id)`
- **PRIMARY KEY** `reports_pkey` on `id`

### Indexes

- `reports_pkey` — `CREATE UNIQUE INDEX reports_pkey ON public.reports USING btree (id)`
- `reports_reported_profile_id_idx` — `CREATE INDEX reports_reported_profile_id_idx ON public.reports USING btree (reported_profile_id)`
- `reports_reporter_profile_id_idx` — `CREATE INDEX reports_reporter_profile_id_idx ON public.reports USING btree (reporter_profile_id)`
- `reports_tournament_id_idx` — `CREATE INDEX reports_tournament_id_idx ON public.reports USING btree (tournament_id)`

### RLS policies

- `reports insert own` — command **INSERT**, roles `{authenticated}`, WITH CHECK `(EXISTS ( SELECT 1    FROM profiles p   WHERE ((p.id = reports.reporter_profile_id) AND (p.user_id = ( SELECT auth.uid() AS uid)))))`.
- `reports read own or staff` — command **SELECT**, roles `{authenticated}`, USING `(private.is_staff() OR (EXISTS ( SELECT 1    FROM profiles p   WHERE ((p.id = reports.reporter_profile_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))`.
- `reports staff manage` — command **UPDATE**, roles `{authenticated}`, USING `private.is_staff()`, WITH CHECK `private.is_staff()`.

## `riot_accounts`

Private Riot account linkage and synchronization metadata.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `profile_id` | `uuid` | no | `—` |
| `riot_id` | `text` | no | `—` |
| `puuid` | `text` | yes | `—` |
| `platform` | `text` | no | `'LA2'::text` |
| `solo_tier` | `text` | yes | `—` |
| `solo_rank` | `text` | yes | `—` |
| `solo_lp` | `integer` | yes | `—` |
| `verified` | `boolean` | no | `false` |
| `last_synced_at` | `timestamp with time zone` | yes | `—` |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `game_name` | `text` | yes | `—` |
| `tag_line` | `text` | yes | `—` |
| `wins` | `integer` | no | `0` |
| `losses` | `integer` | no | `0` |
| `queue_type` | `text` | yes | `—` |
| `data_verified` | `boolean` | no | `false` |
| `ownership_verified` | `boolean` | no | `false` |
| `verification_method` | `text` | no | `'none'::text` |
| `last_sync_status` | `text` | yes | `—` |
| `last_sync_error_code` | `text` | yes | `—` |
| `updated_at` | `timestamp with time zone` | no | `now()` |
| `account_level` | `integer` | yes | `—` |
| `account_level_synced_at` | `timestamp with time zone` | yes | `—` |

### Constraints

- **CHECK** `2200_17693_11_not_null` — `created_at IS NOT NULL`
- **CHECK** `2200_17693_14_not_null` — `wins IS NOT NULL`
- **CHECK** `2200_17693_15_not_null` — `losses IS NOT NULL`
- **CHECK** `2200_17693_17_not_null` — `data_verified IS NOT NULL`
- **CHECK** `2200_17693_18_not_null` — `ownership_verified IS NOT NULL`
- **CHECK** `2200_17693_19_not_null` — `verification_method IS NOT NULL`
- **CHECK** `2200_17693_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_17693_22_not_null` — `updated_at IS NOT NULL`
- **CHECK** `2200_17693_2_not_null` — `profile_id IS NOT NULL`
- **CHECK** `2200_17693_3_not_null` — `riot_id IS NOT NULL`
- **CHECK** `2200_17693_5_not_null` — `platform IS NOT NULL`
- **CHECK** `2200_17693_9_not_null` — `verified IS NOT NULL`
- **FOREIGN KEY** `riot_accounts_profile_id_fkey` on `profile_id` → `profiles(id)`
- **PRIMARY KEY** `riot_accounts_pkey` on `id`
- **UNIQUE** `riot_accounts_profile_id_riot_id_key` on `profile_id, profile_id, riot_id, riot_id`

### Indexes

- `riot_accounts_pkey` — `CREATE UNIQUE INDEX riot_accounts_pkey ON public.riot_accounts USING btree (id)`
- `riot_accounts_profile_id_key` — `CREATE UNIQUE INDEX riot_accounts_profile_id_key ON public.riot_accounts USING btree (profile_id)`
- `riot_accounts_profile_id_riot_id_key` — `CREATE UNIQUE INDEX riot_accounts_profile_id_riot_id_key ON public.riot_accounts USING btree (profile_id, riot_id)`
- `riot_accounts_puuid_key` — `CREATE UNIQUE INDEX riot_accounts_puuid_key ON public.riot_accounts USING btree (puuid) WHERE (puuid IS NOT NULL)`

### RLS policies

- `riot accounts read own` — command **SELECT**, roles `{authenticated}`, USING `(EXISTS ( SELECT 1    FROM profiles p   WHERE ((p.id = riot_accounts.profile_id) AND (p.user_id = ( SELECT auth.uid() AS uid)))))`.
- `riot accounts staff read` — command **SELECT**, roles `{authenticated}`, USING `private.is_staff()`.

### Triggers

- `riot_accounts_updated_at` — BEFORE UPDATE; `EXECUTE FUNCTION set_updated_at()`

## `scrim_challenges`

Challenges sent to practice posts.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `scrim_id` | `uuid` | no | `—` |
| `challenger_team_id` | `uuid` | no | `—` |
| `created_by_profile_id` | `uuid` | no | `—` |
| `status` | `text` | no | `'pending'::text` |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `updated_at` | `timestamp with time zone` | no | `now()` |

### Constraints

- **CHECK** `2200_25637_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_25637_2_not_null` — `scrim_id IS NOT NULL`
- **CHECK** `2200_25637_3_not_null` — `challenger_team_id IS NOT NULL`
- **CHECK** `2200_25637_4_not_null` — `created_by_profile_id IS NOT NULL`
- **CHECK** `2200_25637_5_not_null` — `status IS NOT NULL`
- **CHECK** `2200_25637_6_not_null` — `created_at IS NOT NULL`
- **CHECK** `2200_25637_7_not_null` — `updated_at IS NOT NULL`
- **CHECK** `scrim_challenges_status_check` — `(status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text]))`
- **FOREIGN KEY** `scrim_challenges_challenger_team_id_fkey` on `challenger_team_id` → `teams(id)`
- **FOREIGN KEY** `scrim_challenges_created_by_profile_id_fkey` on `created_by_profile_id` → `profiles(id)`
- **FOREIGN KEY** `scrim_challenges_scrim_id_fkey` on `scrim_id` → `scrim_posts(id)`
- **PRIMARY KEY** `scrim_challenges_pkey` on `id`
- **UNIQUE** `scrim_challenges_scrim_id_challenger_team_id_key` on `scrim_id, scrim_id, challenger_team_id, challenger_team_id`

### Indexes

- `scrim_challenges_pkey` — `CREATE UNIQUE INDEX scrim_challenges_pkey ON public.scrim_challenges USING btree (id)`
- `scrim_challenges_scrim_id_challenger_team_id_key` — `CREATE UNIQUE INDEX scrim_challenges_scrim_id_challenger_team_id_key ON public.scrim_challenges USING btree (scrim_id, challenger_team_id)`
- `scrim_challenges_scrim_status_idx` — `CREATE INDEX scrim_challenges_scrim_status_idx ON public.scrim_challenges USING btree (scrim_id, status)`

### RLS policies

- `Scrim challenge state public read` — command **SELECT**, roles `{anon,authenticated}`, USING `true`.

### Triggers

- `scrim_challenges_updated_at` — BEFORE UPDATE; `EXECUTE FUNCTION set_updated_at()`

## `scrim_posts`

Practice availability, opponent and practice result.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `team_id` | `uuid` | no | `—` |
| `created_by_profile_id` | `uuid` | no | `—` |
| `starts_at` | `timestamp with time zone` | no | `—` |
| `ends_at` | `timestamp with time zone` | yes | `—` |
| `best_of` | `integer` | no | `3` |
| `note` | `text` | yes | `—` |
| `status` | `text` | no | `'open'::text` |
| `opponent_team_id` | `uuid` | yes | `—` |
| `score_team` | `integer` | yes | `—` |
| `score_opponent` | `integer` | yes | `—` |
| `winner_team_id` | `uuid` | yes | `—` |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `updated_at` | `timestamp with time zone` | no | `now()` |

### Constraints

- **CHECK** `2200_25597_13_not_null` — `created_at IS NOT NULL`
- **CHECK** `2200_25597_14_not_null` — `updated_at IS NOT NULL`
- **CHECK** `2200_25597_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_25597_2_not_null` — `team_id IS NOT NULL`
- **CHECK** `2200_25597_3_not_null` — `created_by_profile_id IS NOT NULL`
- **CHECK** `2200_25597_4_not_null` — `starts_at IS NOT NULL`
- **CHECK** `2200_25597_6_not_null` — `best_of IS NOT NULL`
- **CHECK** `2200_25597_8_not_null` — `status IS NOT NULL`
- **CHECK** `scrim_different_teams` — `((opponent_team_id IS NULL) OR (opponent_team_id <> team_id))`
- **CHECK** `scrim_note_length` — `((note IS NULL) OR (char_length(note) <= 240))`
- **CHECK** `scrim_posts_best_of_check` — `(best_of = ANY (ARRAY[1, 3, 5]))`
- **CHECK** `scrim_posts_status_check` — `(status = ANY (ARRAY['open'::text, 'matched'::text, 'cancelled'::text, 'completed'::text]))`
- **CHECK** `scrim_time_order` — `((ends_at IS NULL) OR (ends_at > starts_at))`
- **FOREIGN KEY** `scrim_posts_created_by_profile_id_fkey` on `created_by_profile_id` → `profiles(id)`
- **FOREIGN KEY** `scrim_posts_opponent_team_id_fkey` on `opponent_team_id` → `teams(id)`
- **FOREIGN KEY** `scrim_posts_team_id_fkey` on `team_id` → `teams(id)`
- **FOREIGN KEY** `scrim_posts_winner_team_id_fkey` on `winner_team_id` → `teams(id)`
- **PRIMARY KEY** `scrim_posts_pkey` on `id`

### Indexes

- `scrim_posts_pkey` — `CREATE UNIQUE INDEX scrim_posts_pkey ON public.scrim_posts USING btree (id)`
- `scrim_posts_status_start_idx` — `CREATE INDEX scrim_posts_status_start_idx ON public.scrim_posts USING btree (status, starts_at)`
- `scrim_posts_team_idx` — `CREATE INDEX scrim_posts_team_idx ON public.scrim_posts USING btree (team_id, starts_at DESC)`

### RLS policies

- `Scrim posts public read` — command **SELECT**, roles `{anon,authenticated}`, USING `true`.

### Triggers

- `scrim_posts_updated_at` — BEFORE UPDATE; `EXECUTE FUNCTION set_updated_at()`

## `seasons`

Competitive season windows.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `slug` | `text` | no | `—` |
| `name` | `text` | no | `—` |
| `starts_at` | `timestamp with time zone` | no | `—` |
| `ends_at` | `timestamp with time zone` | no | `—` |
| `is_active` | `boolean` | no | `false` |
| `created_at` | `timestamp with time zone` | no | `now()` |

### Constraints

- **CHECK** `2200_17606_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_17606_2_not_null` — `slug IS NOT NULL`
- **CHECK** `2200_17606_3_not_null` — `name IS NOT NULL`
- **CHECK** `2200_17606_4_not_null` — `starts_at IS NOT NULL`
- **CHECK** `2200_17606_5_not_null` — `ends_at IS NOT NULL`
- **CHECK** `2200_17606_6_not_null` — `is_active IS NOT NULL`
- **CHECK** `2200_17606_7_not_null` — `created_at IS NOT NULL`
- **PRIMARY KEY** `seasons_pkey` on `id`
- **UNIQUE** `seasons_slug_key` on `slug`

### Indexes

- `seasons_pkey` — `CREATE UNIQUE INDEX seasons_pkey ON public.seasons USING btree (id)`
- `seasons_slug_key` — `CREATE UNIQUE INDEX seasons_slug_key ON public.seasons USING btree (slug)`

### RLS policies

- `seasons public read` — command **SELECT**, roles `{public}`, USING `true`.

## `split_qualifications`

Teams qualified into Semi-Split playoffs.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `split_id` | `uuid` | no | `—` |
| `team_id` | `uuid` | no | `—` |
| `qualified_from_tournament_id` | `uuid` | yes | `—` |
| `qualification_position` | `integer` | yes | `—` |
| `replaces_team_id` | `uuid` | yes | `—` |
| `playoff_seed` | `integer` | yes | `—` |
| `status` | `qualification_status` | no | `'qualified'::qualification_status` |
| `qualified_at` | `timestamp with time zone` | no | `now()` |

### Constraints

- **CHECK** `2200_18133_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_18133_2_not_null` — `split_id IS NOT NULL`
- **CHECK** `2200_18133_3_not_null` — `team_id IS NOT NULL`
- **CHECK** `2200_18133_8_not_null` — `status IS NOT NULL`
- **CHECK** `2200_18133_9_not_null` — `qualified_at IS NOT NULL`
- **FOREIGN KEY** `split_qualifications_qualified_from_tournament_id_fkey` on `qualified_from_tournament_id` → `tournaments(id)`
- **FOREIGN KEY** `split_qualifications_replaces_team_id_fkey` on `replaces_team_id` → `teams(id)`
- **FOREIGN KEY** `split_qualifications_split_id_fkey` on `split_id` → `competitive_splits(id)`
- **FOREIGN KEY** `split_qualifications_team_id_fkey` on `team_id` → `teams(id)`
- **PRIMARY KEY** `split_qualifications_pkey` on `id`
- **UNIQUE** `split_qualifications_split_id_team_id_key` on `split_id, split_id, team_id, team_id`

### Indexes

- `split_qualifications_pkey` — `CREATE UNIQUE INDEX split_qualifications_pkey ON public.split_qualifications USING btree (id)`
- `split_qualifications_replaces_team_id_idx` — `CREATE INDEX split_qualifications_replaces_team_id_idx ON public.split_qualifications USING btree (replaces_team_id)`
- `split_qualifications_source_tournament_idx` — `CREATE INDEX split_qualifications_source_tournament_idx ON public.split_qualifications USING btree (qualified_from_tournament_id)`
- `split_qualifications_split_id_team_id_key` — `CREATE UNIQUE INDEX split_qualifications_split_id_team_id_key ON public.split_qualifications USING btree (split_id, team_id)`
- `split_qualifications_team_id_idx` — `CREATE INDEX split_qualifications_team_id_idx ON public.split_qualifications USING btree (team_id)`

### RLS policies

- `Qualifications are public` — command **SELECT**, roles `{public}`, USING `true`.

## `support_requests`

Support/privacy/account-deletion workflow.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `user_id` | `uuid` | no | `—` |
| `profile_id` | `uuid` | yes | `—` |
| `category` | `text` | no | `—` |
| `subject` | `text` | no | `—` |
| `message` | `text` | no | `—` |
| `status` | `text` | no | `'open'::text` |
| `staff_response` | `text` | yes | `—` |
| `resolved_by_user_id` | `uuid` | yes | `—` |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `updated_at` | `timestamp with time zone` | no | `now()` |
| `resolved_at` | `timestamp with time zone` | yes | `—` |

### Constraints

- **CHECK** `2200_18443_10_not_null` — `created_at IS NOT NULL`
- **CHECK** `2200_18443_11_not_null` — `updated_at IS NOT NULL`
- **CHECK** `2200_18443_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_18443_2_not_null` — `user_id IS NOT NULL`
- **CHECK** `2200_18443_4_not_null` — `category IS NOT NULL`
- **CHECK** `2200_18443_5_not_null` — `subject IS NOT NULL`
- **CHECK** `2200_18443_6_not_null` — `message IS NOT NULL`
- **CHECK** `2200_18443_7_not_null` — `status IS NOT NULL`
- **CHECK** `support_requests_category_check` — `(category = ANY (ARRAY['support'::text, 'bug'::text, 'privacy'::text, 'account_deletion'::text]))`
- **CHECK** `support_requests_status_check` — `(status = ANY (ARRAY['open'::text, 'in_review'::text, 'resolved'::text, 'closed'::text]))`
- **FOREIGN KEY** `support_requests_profile_id_fkey` on `profile_id` → `profiles(id)`
- **PRIMARY KEY** `support_requests_pkey` on `id`

### Indexes

- `support_requests_pkey` — `CREATE UNIQUE INDEX support_requests_pkey ON public.support_requests USING btree (id)`
- `support_requests_profile_id_idx` — `CREATE INDEX support_requests_profile_id_idx ON public.support_requests USING btree (profile_id)`
- `support_requests_status_created_at_idx` — `CREATE INDEX support_requests_status_created_at_idx ON public.support_requests USING btree (status, created_at)`
- `support_requests_user_id_created_at_idx` — `CREATE INDEX support_requests_user_id_created_at_idx ON public.support_requests USING btree (user_id, created_at DESC)`

### RLS policies

- No policy rows returned by `pg_policies` for this table.

## `team_invites`

Team invitation lifecycle.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `team_id` | `uuid` | no | `—` |
| `invited_profile_id` | `uuid` | no | `—` |
| `invited_by_profile_id` | `uuid` | no | `—` |
| `role` | `text` | no | `'player'::text` |
| `status` | `text` | no | `'pending'::text` |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `responded_at` | `timestamp with time zone` | yes | `—` |

### Constraints

- **CHECK** `2200_18301_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_18301_2_not_null` — `team_id IS NOT NULL`
- **CHECK** `2200_18301_3_not_null` — `invited_profile_id IS NOT NULL`
- **CHECK** `2200_18301_4_not_null` — `invited_by_profile_id IS NOT NULL`
- **CHECK** `2200_18301_5_not_null` — `role IS NOT NULL`
- **CHECK** `2200_18301_6_not_null` — `status IS NOT NULL`
- **CHECK** `2200_18301_7_not_null` — `created_at IS NOT NULL`
- **CHECK** `team_invites_role_check` — `(lower(role) = ANY (ARRAY['player'::text, 'substitute'::text]))`
- **CHECK** `team_invites_status_check` — `(status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text]))`
- **FOREIGN KEY** `team_invites_invited_by_profile_id_fkey` on `invited_by_profile_id` → `profiles(id)`
- **FOREIGN KEY** `team_invites_invited_profile_id_fkey` on `invited_profile_id` → `profiles(id)`
- **FOREIGN KEY** `team_invites_team_id_fkey` on `team_id` → `teams(id)`
- **PRIMARY KEY** `team_invites_pkey` on `id`

### Indexes

- `team_invites_invited_by_profile_id_idx` — `CREATE INDEX team_invites_invited_by_profile_id_idx ON public.team_invites USING btree (invited_by_profile_id)`
- `team_invites_invited_profile_id_idx` — `CREATE INDEX team_invites_invited_profile_id_idx ON public.team_invites USING btree (invited_profile_id)`
- `team_invites_pending_unique` — `CREATE UNIQUE INDEX team_invites_pending_unique ON public.team_invites USING btree (team_id, invited_profile_id) WHERE (status = 'pending'::text)`
- `team_invites_pkey` — `CREATE UNIQUE INDEX team_invites_pkey ON public.team_invites USING btree (id)`

### RLS policies

- No policy rows returned by `pg_policies` for this table.

## `team_members`

Current team roster, membership role and lane role.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `team_id` | `uuid` | no | `—` |
| `profile_id` | `uuid` | no | `—` |
| `role` | `text` | no | `'Player'::text` |
| `is_captain` | `boolean` | no | `false` |
| `joined_at` | `timestamp with time zone` | no | `now()` |
| `lane_role` | `text` | yes | `—` |

### Constraints

- **CHECK** `2200_17757_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_17757_2_not_null` — `team_id IS NOT NULL`
- **CHECK** `2200_17757_3_not_null` — `profile_id IS NOT NULL`
- **CHECK** `2200_17757_4_not_null` — `role IS NOT NULL`
- **CHECK** `2200_17757_5_not_null` — `is_captain IS NOT NULL`
- **CHECK** `2200_17757_6_not_null` — `joined_at IS NOT NULL`
- **CHECK** `team_members_lane_role_check` — `((lane_role IS NULL) OR (lane_role = ANY (ARRAY['top'::text, 'jungle'::text, 'mid'::text, 'bot'::text, 'support'::text])))`
- **FOREIGN KEY** `team_members_profile_id_fkey` on `profile_id` → `profiles(id)`
- **FOREIGN KEY** `team_members_team_id_fkey` on `team_id` → `teams(id)`
- **PRIMARY KEY** `team_members_pkey` on `id`
- **UNIQUE** `team_members_team_id_profile_id_key` on `team_id, team_id, profile_id, profile_id`

### Indexes

- `team_members_one_team_per_profile` — `CREATE UNIQUE INDEX team_members_one_team_per_profile ON public.team_members USING btree (profile_id)`
- `team_members_pkey` — `CREATE UNIQUE INDEX team_members_pkey ON public.team_members USING btree (id)`
- `team_members_profile_id_idx` — `CREATE INDEX team_members_profile_id_idx ON public.team_members USING btree (profile_id)`
- `team_members_team_id_profile_id_key` — `CREATE UNIQUE INDEX team_members_team_id_profile_id_key ON public.team_members USING btree (team_id, profile_id)`

### RLS policies

- `team members public read` — command **SELECT**, roles `{public}`, USING `true`.

## `team_ranking_points`

Team points ledger.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `team_id` | `uuid` | no | `—` |
| `tournament_id` | `uuid` | yes | `—` |
| `split_id` | `uuid` | yes | `—` |
| `season_id` | `uuid` | yes | `—` |
| `rule_code` | `text` | yes | `—` |
| `points` | `integer` | no | `0` |
| `event_key` | `text` | yes | `—` |
| `note` | `text` | yes | `—` |
| `awarded_at` | `timestamp with time zone` | no | `now()` |

### Constraints

- **CHECK** `2200_18096_10_not_null` — `awarded_at IS NOT NULL`
- **CHECK** `2200_18096_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_18096_2_not_null` — `team_id IS NOT NULL`
- **CHECK** `2200_18096_7_not_null` — `points IS NOT NULL`
- **FOREIGN KEY** `team_ranking_points_rule_code_fkey` on `rule_code` → `point_rules(code)`
- **FOREIGN KEY** `team_ranking_points_season_id_fkey` on `season_id` → `seasons(id)`
- **FOREIGN KEY** `team_ranking_points_split_id_fkey` on `split_id` → `competitive_splits(id)`
- **FOREIGN KEY** `team_ranking_points_team_id_fkey` on `team_id` → `teams(id)`
- **FOREIGN KEY** `team_ranking_points_tournament_id_fkey` on `tournament_id` → `tournaments(id)`
- **PRIMARY KEY** `team_ranking_points_pkey` on `id`

### Indexes

- `team_ranking_points_event_unique` — `CREATE UNIQUE INDEX team_ranking_points_event_unique ON public.team_ranking_points USING btree (team_id, tournament_id, event_key) WHERE ((event_key IS NOT NULL) AND (tournament_id IS NOT NULL))`
- `team_ranking_points_pkey` — `CREATE UNIQUE INDEX team_ranking_points_pkey ON public.team_ranking_points USING btree (id)`
- `team_ranking_points_rule_code_idx` — `CREATE INDEX team_ranking_points_rule_code_idx ON public.team_ranking_points USING btree (rule_code)`
- `team_ranking_points_season_id_idx` — `CREATE INDEX team_ranking_points_season_id_idx ON public.team_ranking_points USING btree (season_id)`
- `team_ranking_points_split_id_idx` — `CREATE INDEX team_ranking_points_split_id_idx ON public.team_ranking_points USING btree (split_id)`
- `team_ranking_points_tournament_id_idx` — `CREATE INDEX team_ranking_points_tournament_id_idx ON public.team_ranking_points USING btree (tournament_id)`

### RLS policies

- `Team points are public` — command **SELECT**, roles `{public}`, USING `true`.

## `teams`

Team identity, captain, geography and cached official totals.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `slug` | `text` | no | `—` |
| `name` | `text` | no | `—` |
| `tag` | `text` | no | `—` |
| `logo_url` | `text` | yes | `—` |
| `bio` | `text` | yes | `—` |
| `division_id` | `uuid` | yes | `—` |
| `region_id` | `uuid` | yes | `—` |
| `country_id` | `uuid` | yes | `—` |
| `city_id` | `uuid` | yes | `—` |
| `captain_id` | `uuid` | yes | `—` |
| `points_season` | `integer` | no | `0` |
| `wins` | `integer` | no | `0` |
| `losses` | `integer` | no | `0` |
| `championships` | `integer` | no | `0` |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `archived_at` | `timestamp with time zone` | yes | `—` |
| `archived_by_profile_id` | `uuid` | yes | `—` |

### Constraints

- **CHECK** `2200_17714_12_not_null` — `points_season IS NOT NULL`
- **CHECK** `2200_17714_13_not_null` — `wins IS NOT NULL`
- **CHECK** `2200_17714_14_not_null` — `losses IS NOT NULL`
- **CHECK** `2200_17714_15_not_null` — `championships IS NOT NULL`
- **CHECK** `2200_17714_16_not_null` — `created_at IS NOT NULL`
- **CHECK** `2200_17714_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_17714_2_not_null` — `slug IS NOT NULL`
- **CHECK** `2200_17714_3_not_null` — `name IS NOT NULL`
- **CHECK** `2200_17714_4_not_null` — `tag IS NOT NULL`
- **FOREIGN KEY** `teams_archived_by_profile_id_fkey` on `archived_by_profile_id` → `profiles(id)`
- **FOREIGN KEY** `teams_captain_id_fkey` on `captain_id` → `profiles(id)`
- **FOREIGN KEY** `teams_city_id_fkey` on `city_id` → `regions(id)`
- **FOREIGN KEY** `teams_country_id_fkey` on `country_id` → `regions(id)`
- **FOREIGN KEY** `teams_division_id_fkey` on `division_id` → `divisions(id)`
- **FOREIGN KEY** `teams_region_id_fkey` on `region_id` → `regions(id)`
- **PRIMARY KEY** `teams_pkey` on `id`
- **UNIQUE** `teams_slug_key` on `slug`

### Indexes

- `teams_archived_at_idx` — `CREATE INDEX teams_archived_at_idx ON public.teams USING btree (archived_at)`
- `teams_archived_by_profile_id_idx` — `CREATE INDEX teams_archived_by_profile_id_idx ON public.teams USING btree (archived_by_profile_id)`
- `teams_captain_id_idx` — `CREATE INDEX teams_captain_id_idx ON public.teams USING btree (captain_id)`
- `teams_city_id_idx` — `CREATE INDEX teams_city_id_idx ON public.teams USING btree (city_id)`
- `teams_country_id_idx` — `CREATE INDEX teams_country_id_idx ON public.teams USING btree (country_id)`
- `teams_division_id_idx` — `CREATE INDEX teams_division_id_idx ON public.teams USING btree (division_id)`
- `teams_name_lower_active_unique` — `CREATE UNIQUE INDEX teams_name_lower_active_unique ON public.teams USING btree (lower(name)) WHERE (archived_at IS NULL)`
- `teams_pkey` — `CREATE UNIQUE INDEX teams_pkey ON public.teams USING btree (id)`
- `teams_region_id_idx` — `CREATE INDEX teams_region_id_idx ON public.teams USING btree (region_id)`
- `teams_slug_key` — `CREATE UNIQUE INDEX teams_slug_key ON public.teams USING btree (slug)`
- `teams_tag_lower_active_unique` — `CREATE UNIQUE INDEX teams_tag_lower_active_unique ON public.teams USING btree (lower(tag)) WHERE (archived_at IS NULL)`

### RLS policies

- `teams public read` — command **SELECT**, roles `{public}`, USING `true`.

## `tournament_entries`

Registered competitor/team entry, seed, placement and scoring summary.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `tournament_id` | `uuid` | no | `—` |
| `profile_id` | `uuid` | yes | `—` |
| `team_id` | `uuid` | yes | `—` |
| `status` | `entry_status` | no | `'registered'::entry_status` |
| `seed` | `integer` | yes | `—` |
| `placement` | `integer` | yes | `—` |
| `points_awarded` | `integer` | no | `0` |
| `checked_in_at` | `timestamp with time zone` | yes | `—` |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `eliminated_in_round` | `integer` | yes | `—` |
| `roster_locked_at` | `timestamp with time zone` | yes | `—` |

### Constraints

- **CHECK** `2200_17816_10_not_null` — `created_at IS NOT NULL`
- **CHECK** `2200_17816_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_17816_2_not_null` — `tournament_id IS NOT NULL`
- **CHECK** `2200_17816_5_not_null` — `status IS NOT NULL`
- **CHECK** `2200_17816_8_not_null` — `points_awarded IS NOT NULL`
- **FOREIGN KEY** `tournament_entries_profile_id_fkey` on `profile_id` → `profiles(id)`
- **FOREIGN KEY** `tournament_entries_team_id_fkey` on `team_id` → `teams(id)`
- **FOREIGN KEY** `tournament_entries_tournament_id_fkey` on `tournament_id` → `tournaments(id)`
- **PRIMARY KEY** `tournament_entries_pkey` on `id`

### Indexes

- `tournament_entries_pkey` — `CREATE UNIQUE INDEX tournament_entries_pkey ON public.tournament_entries USING btree (id)`
- `tournament_entries_profile_id_idx` — `CREATE INDEX tournament_entries_profile_id_idx ON public.tournament_entries USING btree (profile_id)`
- `tournament_entries_profile_uniq` — `CREATE UNIQUE INDEX tournament_entries_profile_uniq ON public.tournament_entries USING btree (tournament_id, profile_id) WHERE (profile_id IS NOT NULL)`
- `tournament_entries_team_id_idx` — `CREATE INDEX tournament_entries_team_id_idx ON public.tournament_entries USING btree (team_id)`
- `tournament_entries_team_uniq` — `CREATE UNIQUE INDEX tournament_entries_team_uniq ON public.tournament_entries USING btree (tournament_id, team_id) WHERE (team_id IS NOT NULL)`

### RLS policies

- `entries public read` — command **SELECT**, roles `{public}`, USING `true`.

## `tournament_roster_members`

Locked immutable roster snapshot for official competition.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `tournament_id` | `uuid` | no | `—` |
| `entry_id` | `uuid` | no | `—` |
| `team_id` | `uuid` | yes | `—` |
| `profile_id` | `uuid` | no | `—` |
| `role` | `text` | no | `'player'::text` |
| `is_captain` | `boolean` | no | `false` |
| `is_substitute` | `boolean` | no | `false` |
| `riot_id` | `text` | yes | `—` |
| `riot_tier` | `text` | yes | `—` |
| `riot_rank` | `text` | yes | `—` |
| `account_level` | `integer` | yes | `—` |
| `locked_at` | `timestamp with time zone` | no | `now()` |

### Constraints

- **CHECK** `2200_18200_13_not_null` — `locked_at IS NOT NULL`
- **CHECK** `2200_18200_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_18200_2_not_null` — `tournament_id IS NOT NULL`
- **CHECK** `2200_18200_3_not_null` — `entry_id IS NOT NULL`
- **CHECK** `2200_18200_5_not_null` — `profile_id IS NOT NULL`
- **CHECK** `2200_18200_6_not_null` — `role IS NOT NULL`
- **CHECK** `2200_18200_7_not_null` — `is_captain IS NOT NULL`
- **CHECK** `2200_18200_8_not_null` — `is_substitute IS NOT NULL`
- **FOREIGN KEY** `tournament_roster_members_entry_id_fkey` on `entry_id` → `tournament_entries(id)`
- **FOREIGN KEY** `tournament_roster_members_profile_id_fkey` on `profile_id` → `profiles(id)`
- **FOREIGN KEY** `tournament_roster_members_team_id_fkey` on `team_id` → `teams(id)`
- **FOREIGN KEY** `tournament_roster_members_tournament_id_fkey` on `tournament_id` → `tournaments(id)`
- **PRIMARY KEY** `tournament_roster_members_pkey` on `id`
- **UNIQUE** `tournament_roster_members_entry_id_profile_id_key` on `entry_id, entry_id, profile_id, profile_id`

### Indexes

- `tournament_roster_members_entry_id_profile_id_key` — `CREATE UNIQUE INDEX tournament_roster_members_entry_id_profile_id_key ON public.tournament_roster_members USING btree (entry_id, profile_id)`
- `tournament_roster_members_pkey` — `CREATE UNIQUE INDEX tournament_roster_members_pkey ON public.tournament_roster_members USING btree (id)`
- `tournament_roster_members_profile_idx` — `CREATE INDEX tournament_roster_members_profile_idx ON public.tournament_roster_members USING btree (profile_id)`
- `tournament_roster_members_team_id_idx` — `CREATE INDEX tournament_roster_members_team_id_idx ON public.tournament_roster_members USING btree (team_id)`
- `tournament_roster_members_tournament_idx` — `CREATE INDEX tournament_roster_members_tournament_idx ON public.tournament_roster_members USING btree (tournament_id)`

### RLS policies

- `Locked rosters are public` — command **SELECT**, roles `{public}`, USING `true`.

### Triggers

- `tournament_roster_members_immutable` — BEFORE UPDATE; `EXECUTE FUNCTION private.roster_snapshot_immutable()`

## `tournaments`

Tournament configuration, registration and operational milestones.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `slug` | `text` | no | `—` |
| `name` | `text` | no | `—` |
| `subtitle` | `text` | yes | `—` |
| `description` | `text` | yes | `—` |
| `rules` | `text` | yes | `—` |
| `banner_url` | `text` | yes | `—` |
| `division_id` | `uuid` | yes | `—` |
| `region_id` | `uuid` | yes | `—` |
| `season_id` | `uuid` | yes | `—` |
| `status` | `tournament_status` | no | `'registration_open'::tournament_status` |
| `format` | `text` | no | `'Single elimination Bo1'::text` |
| `mode` | `text` | no | `'solo'::text` |
| `max_participants` | `integer` | no | `32` |
| `participants_count` | `integer` | no | `0` |
| `prize` | `text` | yes | `—` |
| `registration_closes_at` | `timestamp with time zone` | yes | `—` |
| `starts_at` | `timestamp with time zone` | no | `—` |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `updated_at` | `timestamp with time zone` | no | `now()` |
| `split_id` | `uuid` | yes | `—` |
| `qualifier_index` | `integer` | yes | `—` |
| `split_phase` | `text` | yes | `—` |
| `entries_locked_at` | `timestamp with time zone` | yes | `—` |
| `bracket_generated_at` | `timestamp with time zone` | yes | `—` |
| `finalized_at` | `timestamp with time zone` | yes | `—` |
| `checkin_required` | `boolean` | no | `true` |
| `required_roster_size` | `integer` | no | `5` |
| `min_account_level` | `integer` | no | `30` |
| `required_platform` | `text` | yes | `—` |
| `qualified_teams_registration_opens_at` | `timestamp with time zone` | yes | `—` |

### Constraints

- **CHECK** `2200_17781_11_not_null` — `status IS NOT NULL`
- **CHECK** `2200_17781_12_not_null` — `format IS NOT NULL`
- **CHECK** `2200_17781_13_not_null` — `mode IS NOT NULL`
- **CHECK** `2200_17781_14_not_null` — `max_participants IS NOT NULL`
- **CHECK** `2200_17781_15_not_null` — `participants_count IS NOT NULL`
- **CHECK** `2200_17781_18_not_null` — `starts_at IS NOT NULL`
- **CHECK** `2200_17781_19_not_null` — `created_at IS NOT NULL`
- **CHECK** `2200_17781_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_17781_20_not_null` — `updated_at IS NOT NULL`
- **CHECK** `2200_17781_27_not_null` — `checkin_required IS NOT NULL`
- **CHECK** `2200_17781_28_not_null` — `required_roster_size IS NOT NULL`
- **CHECK** `2200_17781_29_not_null` — `min_account_level IS NOT NULL`
- **CHECK** `2200_17781_2_not_null` — `slug IS NOT NULL`
- **CHECK** `2200_17781_3_not_null` — `name IS NOT NULL`
- **FOREIGN KEY** `tournaments_division_id_fkey` on `division_id` → `divisions(id)`
- **FOREIGN KEY** `tournaments_region_id_fkey` on `region_id` → `regions(id)`
- **FOREIGN KEY** `tournaments_season_id_fkey` on `season_id` → `seasons(id)`
- **FOREIGN KEY** `tournaments_split_id_fkey` on `split_id` → `competitive_splits(id)`
- **PRIMARY KEY** `tournaments_pkey` on `id`
- **UNIQUE** `tournaments_slug_key` on `slug`

### Indexes

- `tournaments_division_id_idx` — `CREATE INDEX tournaments_division_id_idx ON public.tournaments USING btree (division_id)`
- `tournaments_pkey` — `CREATE UNIQUE INDEX tournaments_pkey ON public.tournaments USING btree (id)`
- `tournaments_region_id_idx` — `CREATE INDEX tournaments_region_id_idx ON public.tournaments USING btree (region_id)`
- `tournaments_season_id_idx` — `CREATE INDEX tournaments_season_id_idx ON public.tournaments USING btree (season_id)`
- `tournaments_slug_key` — `CREATE UNIQUE INDEX tournaments_slug_key ON public.tournaments USING btree (slug)`
- `tournaments_split_idx` — `CREATE INDEX tournaments_split_idx ON public.tournaments USING btree (split_id, qualifier_index)`

### RLS policies

- `tournaments admin write` — command **ALL**, roles `{authenticated}`, USING `private.has_role('admin'::app_role)`, WITH CHECK `private.has_role('admin'::app_role)`.
- `tournaments public read` — command **SELECT**, roles `{public}`, USING `true`.

### Triggers

- `tournaments_updated_at` — BEFORE UPDATE; `EXECUTE FUNCTION set_updated_at()`

## `user_roles`

Authorization roles independent from player profile.

### Columns

| Column | Type | Nullable | Default |
| --- | --- | :---: | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `user_id` | `uuid` | no | `—` |
| `role` | `app_role` | no | `—` |
| `created_at` | `timestamp with time zone` | no | `now()` |

### Constraints

- **CHECK** `2200_17681_1_not_null` — `id IS NOT NULL`
- **CHECK** `2200_17681_2_not_null` — `user_id IS NOT NULL`
- **CHECK** `2200_17681_3_not_null` — `role IS NOT NULL`
- **CHECK** `2200_17681_4_not_null` — `created_at IS NOT NULL`
- **PRIMARY KEY** `user_roles_pkey` on `id`
- **UNIQUE** `user_roles_user_id_role_key` on `user_id, user_id, role, role`

### Indexes

- `user_roles_pkey` — `CREATE UNIQUE INDEX user_roles_pkey ON public.user_roles USING btree (id)`
- `user_roles_user_id_role_key` — `CREATE UNIQUE INDEX user_roles_user_id_role_key ON public.user_roles USING btree (user_id, role)`

### RLS policies

- `roles admin write` — command **ALL**, roles `{authenticated}`, USING `private.has_role('admin'::app_role)`, WITH CHECK `private.has_role('admin'::app_role)`.
- `roles read own` — command **SELECT**, roles `{authenticated}`, USING `((user_id = ( SELECT auth.uid() AS uid)) OR private.has_role('admin'::app_role))`.

## Relationship guide

For a readable ER diagram and domain explanation, see [DATABASE.md](./DATABASE.md). For tournament invariants see [COMPETITION_ENGINE.md](./COMPETITION_ENGINE.md).
