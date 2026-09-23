export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17";
  };
  public: {
    Tables: {
      achievements: {
        Row: {
          code: string;
          description: string | null;
          earned_at: string;
          id: string;
          profile_id: string;
          tier: string;
          title: string;
        };
        Insert: {
          code: string;
          description?: string | null;
          earned_at?: string;
          id?: string;
          profile_id: string;
          tier?: string;
          title: string;
        };
        Update: {
          code?: string;
          description?: string | null;
          earned_at?: string;
          id?: string;
          profile_id?: string;
          tier?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "achievements_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      competition_audit_log: {
        Row: {
          action: string;
          actor_user_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: Json;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: Json;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      competitive_splits: {
        Row: {
          created_at: string;
          dispute_deadline_at: string | null;
          division_id: string | null;
          ends_at: string;
          id: string;
          name: string;
          playoff_reveal_at: string | null;
          playoff_size: number;
          qualification_slots_per_qualifier: number;
          region_id: string | null;
          season_id: string;
          slug: string;
          starts_at: string;
          status: Database["public"]["Enums"]["split_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          dispute_deadline_at?: string | null;
          division_id?: string | null;
          ends_at: string;
          id?: string;
          name: string;
          playoff_reveal_at?: string | null;
          playoff_size?: number;
          qualification_slots_per_qualifier?: number;
          region_id?: string | null;
          season_id: string;
          slug: string;
          starts_at: string;
          status?: Database["public"]["Enums"]["split_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          dispute_deadline_at?: string | null;
          division_id?: string | null;
          ends_at?: string;
          id?: string;
          name?: string;
          playoff_reveal_at?: string | null;
          playoff_size?: number;
          qualification_slots_per_qualifier?: number;
          region_id?: string | null;
          season_id?: string;
          slug?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["split_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "competitive_splits_division_id_fkey";
            columns: ["division_id"];
            isOneToOne: false;
            referencedRelation: "divisions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "competitive_splits_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "competitive_splits_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      divisions: {
        Row: {
          accent: string;
          code: string;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          riot_tiers: string[];
          sort_order: number;
        };
        Insert: {
          accent?: string;
          code: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          riot_tiers?: string[];
          sort_order?: number;
        };
        Update: {
          accent?: string;
          code?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          riot_tiers?: string[];
          sort_order?: number;
        };
        Relationships: [];
      };
      eligibility_reviews: {
        Row: {
          created_at: string;
          id: string;
          notes: string | null;
          profile_id: string;
          reason: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["eligibility_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          profile_id: string;
          reason?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["eligibility_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          profile_id?: string;
          reason?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["eligibility_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "eligibility_reviews_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      match_players: {
        Row: {
          assists: number;
          champion: string | null;
          created_at: string;
          deaths: number;
          id: string;
          is_win: boolean;
          kills: number;
          match_id: string;
          profile_id: string;
          side: string;
        };
        Insert: {
          assists?: number;
          champion?: string | null;
          created_at?: string;
          deaths?: number;
          id?: string;
          is_win?: boolean;
          kills?: number;
          match_id: string;
          profile_id: string;
          side?: string;
        };
        Update: {
          assists?: number;
          champion?: string | null;
          created_at?: string;
          deaths?: number;
          id?: string;
          is_win?: boolean;
          kills?: number;
          match_id?: string;
          profile_id?: string;
          side?: string;
        };
        Relationships: [
          {
            foreignKeyName: "match_players_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_players_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      matches: {
        Row: {
          best_of: number;
          bracket_slot: number;
          created_at: string;
          entry_a_id: string | null;
          entry_b_id: string | null;
          id: string;
          is_bye: boolean;
          resolution_note: string | null;
          resolution_type: string;
          resolved_at: string | null;
          resolved_by_user_id: string | null;
          round_index: number;
          round_label: string;
          scheduled_at: string | null;
          score_a: number;
          score_b: number;
          status: Database["public"]["Enums"]["match_status"];
          tournament_id: string;
          winner_entry_id: string | null;
        };
        Insert: {
          best_of?: number;
          bracket_slot?: number;
          created_at?: string;
          entry_a_id?: string | null;
          entry_b_id?: string | null;
          id?: string;
          is_bye?: boolean;
          resolution_note?: string | null;
          resolution_type?: string;
          resolved_at?: string | null;
          resolved_by_user_id?: string | null;
          round_index?: number;
          round_label: string;
          scheduled_at?: string | null;
          score_a?: number;
          score_b?: number;
          status?: Database["public"]["Enums"]["match_status"];
          tournament_id: string;
          winner_entry_id?: string | null;
        };
        Update: {
          best_of?: number;
          bracket_slot?: number;
          created_at?: string;
          entry_a_id?: string | null;
          entry_b_id?: string | null;
          id?: string;
          is_bye?: boolean;
          resolution_note?: string | null;
          resolution_type?: string;
          resolved_at?: string | null;
          resolved_by_user_id?: string | null;
          round_index?: number;
          round_label?: string;
          scheduled_at?: string | null;
          score_a?: number;
          score_b?: number;
          status?: Database["public"]["Enums"]["match_status"];
          tournament_id?: string;
          winner_entry_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "matches_entry_a_id_fkey";
            columns: ["entry_a_id"];
            isOneToOne: false;
            referencedRelation: "tournament_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_entry_b_id_fkey";
            columns: ["entry_b_id"];
            isOneToOne: false;
            referencedRelation: "tournament_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_tournament_id_fkey";
            columns: ["tournament_id"];
            isOneToOne: false;
            referencedRelation: "tournaments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_winner_entry_id_fkey";
            columns: ["winner_entry_id"];
            isOneToOne: false;
            referencedRelation: "tournament_entries";
            referencedColumns: ["id"];
          },
        ];
      };
      point_rules: {
        Row: {
          code: string;
          label: string;
          points: number;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          code: string;
          label: string;
          points: number;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          code?: string;
          label?: string;
          points?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          city_id: string | null;
          country_id: string | null;
          created_at: string;
          display_name: string;
          division_id: string | null;
          eligibility: Database["public"]["Enums"]["eligibility_status"];
          handle: string;
          id: string;
          is_demo: boolean;
          losses: number;
          points_month: number;
          points_season: number;
          profile_completion: number;
          province_id: string | null;
          rank_movement: number;
          region_id: string | null;
          riot_id: string | null;
          riot_rank: string | null;
          riot_tier: string | null;
          tournaments_played: number;
          updated_at: string;
          user_id: string | null;
          wins: number;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          city_id?: string | null;
          country_id?: string | null;
          created_at?: string;
          display_name: string;
          division_id?: string | null;
          eligibility?: Database["public"]["Enums"]["eligibility_status"];
          handle: string;
          id?: string;
          is_demo?: boolean;
          losses?: number;
          points_month?: number;
          points_season?: number;
          profile_completion?: number;
          province_id?: string | null;
          rank_movement?: number;
          region_id?: string | null;
          riot_id?: string | null;
          riot_rank?: string | null;
          riot_tier?: string | null;
          tournaments_played?: number;
          updated_at?: string;
          user_id?: string | null;
          wins?: number;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          city_id?: string | null;
          country_id?: string | null;
          created_at?: string;
          display_name?: string;
          division_id?: string | null;
          eligibility?: Database["public"]["Enums"]["eligibility_status"];
          handle?: string;
          id?: string;
          is_demo?: boolean;
          losses?: number;
          points_month?: number;
          points_season?: number;
          profile_completion?: number;
          province_id?: string | null;
          rank_movement?: number;
          region_id?: string | null;
          riot_id?: string | null;
          riot_rank?: string | null;
          riot_tier?: string | null;
          tournaments_played?: number;
          updated_at?: string;
          user_id?: string | null;
          wins?: number;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_city_id_fkey";
            columns: ["city_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_country_id_fkey";
            columns: ["country_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_division_id_fkey";
            columns: ["division_id"];
            isOneToOne: false;
            referencedRelation: "divisions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_province_id_fkey";
            columns: ["province_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
        ];
      };
      ranking_points: {
        Row: {
          awarded_at: string;
          event_key: string | null;
          id: string;
          note: string | null;
          points: number;
          profile_id: string;
          rule_code: string | null;
          season_id: string | null;
          tournament_id: string | null;
        };
        Insert: {
          awarded_at?: string;
          event_key?: string | null;
          id?: string;
          note?: string | null;
          points: number;
          profile_id: string;
          rule_code?: string | null;
          season_id?: string | null;
          tournament_id?: string | null;
        };
        Update: {
          awarded_at?: string;
          event_key?: string | null;
          id?: string;
          note?: string | null;
          points?: number;
          profile_id?: string;
          rule_code?: string | null;
          season_id?: string | null;
          tournament_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ranking_points_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ranking_points_rule_code_fkey";
            columns: ["rule_code"];
            isOneToOne: false;
            referencedRelation: "point_rules";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "ranking_points_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ranking_points_tournament_id_fkey";
            columns: ["tournament_id"];
            isOneToOne: false;
            referencedRelation: "tournaments";
            referencedColumns: ["id"];
          },
        ];
      };
      regions: {
        Row: {
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["region_kind"];
          name: string;
          parent_id: string | null;
          slug: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["region_kind"];
          name: string;
          parent_id?: string | null;
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["region_kind"];
          name?: string;
          parent_id?: string | null;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "regions_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          created_at: string;
          details: string | null;
          id: string;
          reason: string;
          reported_profile_id: string | null;
          reporter_profile_id: string | null;
          status: Database["public"]["Enums"]["report_status"];
          tournament_id: string | null;
        };
        Insert: {
          created_at?: string;
          details?: string | null;
          id?: string;
          reason: string;
          reported_profile_id?: string | null;
          reporter_profile_id?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          tournament_id?: string | null;
        };
        Update: {
          created_at?: string;
          details?: string | null;
          id?: string;
          reason?: string;
          reported_profile_id?: string | null;
          reporter_profile_id?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          tournament_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reports_reported_profile_id_fkey";
            columns: ["reported_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reporter_profile_id_fkey";
            columns: ["reporter_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_tournament_id_fkey";
            columns: ["tournament_id"];
            isOneToOne: false;
            referencedRelation: "tournaments";
            referencedColumns: ["id"];
          },
        ];
      };
      riot_accounts: {
        Row: {
          account_level: number | null;
          account_level_synced_at: string | null;
          created_at: string;
          data_verified: boolean;
          game_name: string | null;
          id: string;
          last_sync_error_code: string | null;
          last_sync_status: string | null;
          last_synced_at: string | null;
          losses: number;
          ownership_verified: boolean;
          platform: string;
          profile_id: string;
          puuid: string | null;
          queue_type: string | null;
          riot_id: string;
          solo_lp: number | null;
          solo_rank: string | null;
          solo_tier: string | null;
          tag_line: string | null;
          updated_at: string;
          verification_method: string;
          verified: boolean;
          wins: number;
        };
        Insert: {
          account_level?: number | null;
          account_level_synced_at?: string | null;
          created_at?: string;
          data_verified?: boolean;
          game_name?: string | null;
          id?: string;
          last_sync_error_code?: string | null;
          last_sync_status?: string | null;
          last_synced_at?: string | null;
          losses?: number;
          ownership_verified?: boolean;
          platform?: string;
          profile_id: string;
          puuid?: string | null;
          queue_type?: string | null;
          riot_id: string;
          solo_lp?: number | null;
          solo_rank?: string | null;
          solo_tier?: string | null;
          tag_line?: string | null;
          updated_at?: string;
          verification_method?: string;
          verified?: boolean;
          wins?: number;
        };
        Update: {
          account_level?: number | null;
          account_level_synced_at?: string | null;
          created_at?: string;
          data_verified?: boolean;
          game_name?: string | null;
          id?: string;
          last_sync_error_code?: string | null;
          last_sync_status?: string | null;
          last_synced_at?: string | null;
          losses?: number;
          ownership_verified?: boolean;
          platform?: string;
          profile_id?: string;
          puuid?: string | null;
          queue_type?: string | null;
          riot_id?: string;
          solo_lp?: number | null;
          solo_rank?: string | null;
          solo_tier?: string | null;
          tag_line?: string | null;
          updated_at?: string;
          verification_method?: string;
          verified?: boolean;
          wins?: number;
        };
        Relationships: [
          {
            foreignKeyName: "riot_accounts_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      seasons: {
        Row: {
          created_at: string;
          ends_at: string;
          id: string;
          is_active: boolean;
          name: string;
          slug: string;
          starts_at: string;
        };
        Insert: {
          created_at?: string;
          ends_at: string;
          id?: string;
          is_active?: boolean;
          name: string;
          slug: string;
          starts_at: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          slug?: string;
          starts_at?: string;
        };
        Relationships: [];
      };
      split_qualifications: {
        Row: {
          id: string;
          playoff_seed: number | null;
          qualification_position: number | null;
          qualified_at: string;
          qualified_from_tournament_id: string | null;
          replaces_team_id: string | null;
          split_id: string;
          status: Database["public"]["Enums"]["qualification_status"];
          team_id: string;
        };
        Insert: {
          id?: string;
          playoff_seed?: number | null;
          qualification_position?: number | null;
          qualified_at?: string;
          qualified_from_tournament_id?: string | null;
          replaces_team_id?: string | null;
          split_id: string;
          status?: Database["public"]["Enums"]["qualification_status"];
          team_id: string;
        };
        Update: {
          id?: string;
          playoff_seed?: number | null;
          qualification_position?: number | null;
          qualified_at?: string;
          qualified_from_tournament_id?: string | null;
          replaces_team_id?: string | null;
          split_id?: string;
          status?: Database["public"]["Enums"]["qualification_status"];
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "split_qualifications_qualified_from_tournament_id_fkey";
            columns: ["qualified_from_tournament_id"];
            isOneToOne: false;
            referencedRelation: "tournaments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "split_qualifications_replaces_team_id_fkey";
            columns: ["replaces_team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "split_qualifications_split_id_fkey";
            columns: ["split_id"];
            isOneToOne: false;
            referencedRelation: "competitive_splits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "split_qualifications_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      team_members: {
        Row: {
          id: string;
          is_captain: boolean;
          joined_at: string;
          profile_id: string;
          role: string;
          team_id: string;
        };
        Insert: {
          id?: string;
          is_captain?: boolean;
          joined_at?: string;
          profile_id: string;
          role?: string;
          team_id: string;
        };
        Update: {
          id?: string;
          is_captain?: boolean;
          joined_at?: string;
          profile_id?: string;
          role?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_members_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      team_ranking_points: {
        Row: {
          awarded_at: string;
          event_key: string | null;
          id: string;
          note: string | null;
          points: number;
          rule_code: string | null;
          season_id: string | null;
          split_id: string | null;
          team_id: string;
          tournament_id: string | null;
        };
        Insert: {
          awarded_at?: string;
          event_key?: string | null;
          id?: string;
          note?: string | null;
          points?: number;
          rule_code?: string | null;
          season_id?: string | null;
          split_id?: string | null;
          team_id: string;
          tournament_id?: string | null;
        };
        Update: {
          awarded_at?: string;
          event_key?: string | null;
          id?: string;
          note?: string | null;
          points?: number;
          rule_code?: string | null;
          season_id?: string | null;
          split_id?: string | null;
          team_id?: string;
          tournament_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "team_ranking_points_rule_code_fkey";
            columns: ["rule_code"];
            isOneToOne: false;
            referencedRelation: "point_rules";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "team_ranking_points_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_ranking_points_split_id_fkey";
            columns: ["split_id"];
            isOneToOne: false;
            referencedRelation: "competitive_splits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_ranking_points_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_ranking_points_tournament_id_fkey";
            columns: ["tournament_id"];
            isOneToOne: false;
            referencedRelation: "tournaments";
            referencedColumns: ["id"];
          },
        ];
      };
      teams: {
        Row: {
          bio: string | null;
          captain_id: string | null;
          championships: number;
          city_id: string | null;
          country_id: string | null;
          created_at: string;
          division_id: string | null;
          id: string;
          logo_url: string | null;
          losses: number;
          name: string;
          points_season: number;
          region_id: string | null;
          slug: string;
          tag: string;
          wins: number;
        };
        Insert: {
          bio?: string | null;
          captain_id?: string | null;
          championships?: number;
          city_id?: string | null;
          country_id?: string | null;
          created_at?: string;
          division_id?: string | null;
          id?: string;
          logo_url?: string | null;
          losses?: number;
          name: string;
          points_season?: number;
          region_id?: string | null;
          slug: string;
          tag: string;
          wins?: number;
        };
        Update: {
          bio?: string | null;
          captain_id?: string | null;
          championships?: number;
          city_id?: string | null;
          country_id?: string | null;
          created_at?: string;
          division_id?: string | null;
          id?: string;
          logo_url?: string | null;
          losses?: number;
          name?: string;
          points_season?: number;
          region_id?: string | null;
          slug?: string;
          tag?: string;
          wins?: number;
        };
        Relationships: [
          {
            foreignKeyName: "teams_captain_id_fkey";
            columns: ["captain_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teams_city_id_fkey";
            columns: ["city_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teams_country_id_fkey";
            columns: ["country_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teams_division_id_fkey";
            columns: ["division_id"];
            isOneToOne: false;
            referencedRelation: "divisions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teams_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
        ];
      };
      tournament_entries: {
        Row: {
          checked_in_at: string | null;
          created_at: string;
          eliminated_in_round: number | null;
          id: string;
          placement: number | null;
          points_awarded: number;
          profile_id: string | null;
          roster_locked_at: string | null;
          seed: number | null;
          status: Database["public"]["Enums"]["entry_status"];
          team_id: string | null;
          tournament_id: string;
        };
        Insert: {
          checked_in_at?: string | null;
          created_at?: string;
          eliminated_in_round?: number | null;
          id?: string;
          placement?: number | null;
          points_awarded?: number;
          profile_id?: string | null;
          roster_locked_at?: string | null;
          seed?: number | null;
          status?: Database["public"]["Enums"]["entry_status"];
          team_id?: string | null;
          tournament_id: string;
        };
        Update: {
          checked_in_at?: string | null;
          created_at?: string;
          eliminated_in_round?: number | null;
          id?: string;
          placement?: number | null;
          points_awarded?: number;
          profile_id?: string | null;
          roster_locked_at?: string | null;
          seed?: number | null;
          status?: Database["public"]["Enums"]["entry_status"];
          team_id?: string | null;
          tournament_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tournament_entries_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tournament_entries_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tournament_entries_tournament_id_fkey";
            columns: ["tournament_id"];
            isOneToOne: false;
            referencedRelation: "tournaments";
            referencedColumns: ["id"];
          },
        ];
      };
      tournament_roster_members: {
        Row: {
          account_level: number | null;
          entry_id: string;
          id: string;
          is_captain: boolean;
          is_substitute: boolean;
          locked_at: string;
          profile_id: string;
          riot_id: string | null;
          riot_rank: string | null;
          riot_tier: string | null;
          role: string;
          team_id: string | null;
          tournament_id: string;
        };
        Insert: {
          account_level?: number | null;
          entry_id: string;
          id?: string;
          is_captain?: boolean;
          is_substitute?: boolean;
          locked_at?: string;
          profile_id: string;
          riot_id?: string | null;
          riot_rank?: string | null;
          riot_tier?: string | null;
          role?: string;
          team_id?: string | null;
          tournament_id: string;
        };
        Update: {
          account_level?: number | null;
          entry_id?: string;
          id?: string;
          is_captain?: boolean;
          is_substitute?: boolean;
          locked_at?: string;
          profile_id?: string;
          riot_id?: string | null;
          riot_rank?: string | null;
          riot_tier?: string | null;
          role?: string;
          team_id?: string | null;
          tournament_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tournament_roster_members_entry_id_fkey";
            columns: ["entry_id"];
            isOneToOne: false;
            referencedRelation: "tournament_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tournament_roster_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tournament_roster_members_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tournament_roster_members_tournament_id_fkey";
            columns: ["tournament_id"];
            isOneToOne: false;
            referencedRelation: "tournaments";
            referencedColumns: ["id"];
          },
        ];
      };
      tournaments: {
        Row: {
          banner_url: string | null;
          bracket_generated_at: string | null;
          checkin_required: boolean;
          created_at: string;
          description: string | null;
          division_id: string | null;
          entries_locked_at: string | null;
          finalized_at: string | null;
          format: string;
          id: string;
          max_participants: number;
          min_account_level: number;
          mode: string;
          name: string;
          participants_count: number;
          prize: string | null;
          qualifier_index: number | null;
          region_id: string | null;
          registration_closes_at: string | null;
          required_platform: string | null;
          required_roster_size: number;
          rules: string | null;
          season_id: string | null;
          slug: string;
          split_id: string | null;
          split_phase: string | null;
          starts_at: string;
          status: Database["public"]["Enums"]["tournament_status"];
          subtitle: string | null;
          updated_at: string;
        };
        Insert: {
          banner_url?: string | null;
          bracket_generated_at?: string | null;
          checkin_required?: boolean;
          created_at?: string;
          description?: string | null;
          division_id?: string | null;
          entries_locked_at?: string | null;
          finalized_at?: string | null;
          format?: string;
          id?: string;
          max_participants?: number;
          min_account_level?: number;
          mode?: string;
          name: string;
          participants_count?: number;
          prize?: string | null;
          qualifier_index?: number | null;
          region_id?: string | null;
          registration_closes_at?: string | null;
          required_platform?: string | null;
          required_roster_size?: number;
          rules?: string | null;
          season_id?: string | null;
          slug: string;
          split_id?: string | null;
          split_phase?: string | null;
          starts_at: string;
          status?: Database["public"]["Enums"]["tournament_status"];
          subtitle?: string | null;
          updated_at?: string;
        };
        Update: {
          banner_url?: string | null;
          bracket_generated_at?: string | null;
          checkin_required?: boolean;
          created_at?: string;
          description?: string | null;
          division_id?: string | null;
          entries_locked_at?: string | null;
          finalized_at?: string | null;
          format?: string;
          id?: string;
          max_participants?: number;
          min_account_level?: number;
          mode?: string;
          name?: string;
          participants_count?: number;
          prize?: string | null;
          qualifier_index?: number | null;
          region_id?: string | null;
          registration_closes_at?: string | null;
          required_platform?: string | null;
          required_roster_size?: number;
          rules?: string | null;
          season_id?: string | null;
          slug?: string;
          split_id?: string | null;
          split_phase?: string | null;
          starts_at?: string;
          status?: Database["public"]["Enums"]["tournament_status"];
          subtitle?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tournaments_division_id_fkey";
            columns: ["division_id"];
            isOneToOne: false;
            referencedRelation: "divisions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tournaments_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tournaments_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tournaments_split_id_fkey";
            columns: ["split_id"];
            isOneToOne: false;
            referencedRelation: "competitive_splits";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      split_standings: {
        Args: { p_split: string };
        Returns: {
          division_code: string;
          logo_url: string;
          losses: number;
          points: number;
          qualification_position: number;
          qualification_status: string;
          qualified_from: string;
          team_id: string;
          team_name: string;
          team_slug: string;
          team_tag: string;
          tournaments_played: number;
          wins: number;
        }[];
      };
      staff_create_bracket: {
        Args: { p_matches: Json; p_seeds: Json; p_tournament: string };
        Returns: Json;
      };
      staff_correct_match_result: {
        Args: { p_match: string; p_note: string; p_score_a: number; p_score_b: number };
        Returns: Json;
      };
      staff_finalize_tournament: {
        Args: { p_tournament: string };
        Returns: Json;
      };
      staff_generate_split_playoffs: {
        Args: {
          p_allow_short_field?: boolean;
          p_best_of?: number;
          p_reason?: string;
          p_split: string;
        };
        Returns: Json;
      };
      staff_lock_tournament_entries: {
        Args: { p_tournament: string };
        Returns: Json;
      };
      staff_replace_withdrawn_qualifier: {
        Args: { p_split: string; p_team: string };
        Returns: Json;
      };
      staff_record_match_walkover: {
        Args: { p_match: string; p_note: string; p_winner_entry: string };
        Returns: Json;
      };
      staff_report_match_result: {
        Args: { p_match: string; p_score_a: number; p_score_b: number };
        Returns: Json;
      };
      staff_set_split_status: {
        Args: { p_split: string; p_status: string };
        Returns: Json;
      };
    };
    Enums: {
      app_role: "admin" | "moderator" | "player";
      eligibility_status: "eligible" | "pending_review" | "rejected" | "suspended";
      entry_status: "registered" | "checked_in" | "withdrawn" | "disqualified";
      match_status: "scheduled" | "live" | "completed" | "cancelled";
      qualification_status: "qualified" | "withdrawn" | "replaced";
      region_kind: "region" | "country" | "province" | "city";
      report_status: "open" | "reviewing" | "resolved" | "dismissed";
      split_status:
        | "upcoming"
        | "qualifiers"
        | "seeding"
        | "playoffs"
        | "semifinals"
        | "final"
        | "completed"
        | "cancelled";
      tournament_status:
        "draft" | "registration_open" | "registration_closed" | "live" | "completed" | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "player"],
      eligibility_status: ["eligible", "pending_review", "rejected", "suspended"],
      entry_status: ["registered", "checked_in", "withdrawn", "disqualified"],
      match_status: ["scheduled", "live", "completed", "cancelled"],
      qualification_status: ["qualified", "withdrawn", "replaced"],
      region_kind: ["region", "country", "province", "city"],
      report_status: ["open", "reviewing", "resolved", "dismissed"],
      split_status: [
        "upcoming",
        "qualifiers",
        "seeding",
        "playoffs",
        "semifinals",
        "final",
        "completed",
        "cancelled",
      ],
      tournament_status: [
        "draft",
        "registration_open",
        "registration_closed",
        "live",
        "completed",
        "cancelled",
      ],
    },
  },
} as const;
