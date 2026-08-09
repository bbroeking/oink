export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          category: string
          description: string | null
          display_category: string
          display_order: number
          icon: string | null
          id: string
          is_top_tier: boolean
          name: string
          reward_item_id: string | null
          reward_snouts: number
          reward_title_id: string | null
          threshold: number
          tier: number
        }
        Insert: {
          category: string
          description?: string | null
          display_category?: string
          display_order?: number
          icon?: string | null
          id: string
          is_top_tier?: boolean
          name: string
          reward_item_id?: string | null
          reward_snouts?: number
          reward_title_id?: string | null
          threshold: number
          tier: number
        }
        Update: {
          category?: string
          description?: string | null
          display_category?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_top_tier?: boolean
          name?: string
          reward_item_id?: string | null
          reward_snouts?: number
          reward_title_id?: string | null
          threshold?: number
          tier?: number
        }
        Relationships: [
          {
            foreignKeyName: "achievements_reward_item_id_fkey"
            columns: ["reward_item_id"]
            isOneToOne: false
            referencedRelation: "hats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievements_reward_title_id_fkey"
            columns: ["reward_title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      barn_guestbook_stamps: {
        Row: {
          blessing_id: string | null
          created_at: string
          host_id: string
          id: number
          stamp_id: string
          visit_started_at: string
          visitor_id: string
        }
        Insert: {
          blessing_id?: string | null
          created_at?: string
          host_id: string
          id?: number
          stamp_id: string
          visit_started_at: string
          visitor_id: string
        }
        Update: {
          blessing_id?: string | null
          created_at?: string
          host_id?: string
          id?: number
          stamp_id?: string
          visit_started_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "barn_guestbook_stamps_blessing_id_fkey"
            columns: ["blessing_id"]
            isOneToOne: true
            referencedRelation: "blessings"
            referencedColumns: ["id"]
          },
        ]
      }
      barn_visits: {
        Row: {
          created_at: string
          id: number
          target_id: string
          tickles: number
          visit_cap: number | null
          visit_started_at: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          target_id: string
          tickles: number
          visit_cap?: number | null
          visit_started_at?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: number
          target_id?: string
          tickles?: number
          visit_cap?: number | null
          visit_started_at?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      beta_reward_grants: {
        Row: {
          granted_at: string
          rank: number | null
          season_key: string
          snouts: number
          tier: string
          title_id: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          rank?: number | null
          season_key?: string
          snouts?: number
          tier: string
          title_id?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          rank?: number | null
          season_key?: string
          snouts?: number
          tier?: string
          title_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beta_reward_grants_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      blessings: {
        Row: {
          cleared_at: string | null
          expires_at: string | null
          id: string
          kind: string
          receiver_id: string
          sender_id: string
          sent_at: string
          sent_on: string | null
        }
        Insert: {
          cleared_at?: string | null
          expires_at?: string | null
          id?: string
          kind: string
          receiver_id: string
          sender_id: string
          sent_at?: string
          sent_on?: string | null
        }
        Update: {
          cleared_at?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          receiver_id?: string
          sender_id?: string
          sent_at?: string
          sent_on?: string | null
        }
        Relationships: []
      }
      cosmetic_supply: {
        Row: {
          created_at: string
          hat_id: string
          issued_count: number
          max_owners: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          hat_id: string
          issued_count?: number
          max_owners: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          hat_id?: string
          issued_count?: number
          max_owners?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cosmetic_supply_hat_id_fkey"
            columns: ["hat_id"]
            isOneToOne: true
            referencedRelation: "hats"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_invites: {
        Row: {
          created_at: string
          crew_id: string
          id: string
          invitee_id: string
          inviter_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          crew_id: string
          id?: string
          invitee_id: string
          inviter_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          crew_id?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_invites_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_join_requests: {
        Row: {
          created_at: string
          crew_id: string
          id: string
          requester_id: string
          status: string
        }
        Insert: {
          created_at?: string
          crew_id: string
          id?: string
          requester_id: string
          status?: string
        }
        Update: {
          created_at?: string
          crew_id?: string
          id?: string
          requester_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_join_requests_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_members: {
        Row: {
          crew_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          crew_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          crew_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_members_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_milestones: {
        Row: {
          crew_id: string
          reached_at: string
          threshold: number
        }
        Insert: {
          crew_id: string
          reached_at?: string
          threshold: number
        }
        Update: {
          crew_id?: string
          reached_at?: string
          threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "crew_milestones_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      crews: {
        Row: {
          created_at: string
          id: string
          is_bot: boolean
          leader_id: string | null
          lifetime_finds: number
          name: string
          next_war_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_bot?: boolean
          leader_id?: string | null
          lifetime_finds?: number
          name: string
          next_war_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_bot?: boolean
          leader_id?: string | null
          lifetime_finds?: number
          name?: string
          next_war_at?: string | null
        }
        Relationships: []
      }
      curses: {
        Row: {
          cleared_at: string | null
          expires_at: string | null
          id: string
          kind: string
          receiver_id: string
          sender_id: string
          sent_at: string
          sent_on: string | null
          snouts_taken: number
        }
        Insert: {
          cleared_at?: string | null
          expires_at?: string | null
          id?: string
          kind: string
          receiver_id: string
          sender_id: string
          sent_at?: string
          sent_on?: string | null
          snouts_taken?: number
        }
        Update: {
          cleared_at?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          receiver_id?: string
          sender_id?: string
          sent_at?: string
          sent_on?: string | null
          snouts_taken?: number
        }
        Relationships: []
      }
      cycle_notices: {
        Row: {
          cycle_key: string
          start_pushed_at: string
        }
        Insert: {
          cycle_key: string
          start_pushed_at?: string
        }
        Update: {
          cycle_key?: string
          start_pushed_at?: string
        }
        Relationships: []
      }
      cycle_payouts: {
        Row: {
          cycle_key: string
          detail: Json
          paid_at: string
        }
        Insert: {
          cycle_key: string
          detail?: Json
          paid_at?: string
        }
        Update: {
          cycle_key?: string
          detail?: Json
          paid_at?: string
        }
        Relationships: []
      }
      daily_lucky_claims: {
        Row: {
          claimed_at: string
          d: string
          number: number
          user_id: string
        }
        Insert: {
          claimed_at?: string
          d: string
          number: number
          user_id: string
        }
        Update: {
          claimed_at?: string
          d?: string
          number?: number
          user_id?: string
        }
        Relationships: []
      }
      daily_lucky_state: {
        Row: {
          d: string
          global_counter: number
          numbers: number[]
          rolled_at: string
        }
        Insert: {
          d: string
          global_counter?: number
          numbers: number[]
          rolled_at?: string
        }
        Update: {
          d?: string
          global_counter?: number
          numbers?: number[]
          rolled_at?: string
        }
        Relationships: []
      }
      dig_off_digs: {
        Row: {
          crew_id: string
          dig_off_id: string
          finds: number
          user_id: string
          window_index: number
        }
        Insert: {
          crew_id: string
          dig_off_id: string
          finds?: number
          user_id: string
          window_index: number
        }
        Update: {
          crew_id?: string
          dig_off_id?: string
          finds?: number
          user_id?: string
          window_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "dig_off_digs_dig_off_id_fkey"
            columns: ["dig_off_id"]
            isOneToOne: false
            referencedRelation: "dig_offs"
            referencedColumns: ["id"]
          },
        ]
      }
      dig_offs: {
        Row: {
          challenger_crew: string
          created_at: string
          crew_a: string
          crew_b: string
          ends_at: string | null
          id: string
          is_bot: boolean
          outcome: string | null
          pot_a: number
          pot_b: number
          resolved_at: string | null
          starts_at: string | null
          status: string
          winner_crew: string | null
        }
        Insert: {
          challenger_crew: string
          created_at?: string
          crew_a: string
          crew_b: string
          ends_at?: string | null
          id?: string
          is_bot?: boolean
          outcome?: string | null
          pot_a?: number
          pot_b?: number
          resolved_at?: string | null
          starts_at?: string | null
          status?: string
          winner_crew?: string | null
        }
        Update: {
          challenger_crew?: string
          created_at?: string
          crew_a?: string
          crew_b?: string
          ends_at?: string | null
          id?: string
          is_bot?: boolean
          outcome?: string | null
          pot_a?: number
          pot_b?: number
          resolved_at?: string | null
          starts_at?: string | null
          status?: string
          winner_crew?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dig_offs_crew_a_fkey"
            columns: ["crew_a"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dig_offs_crew_b_fkey"
            columns: ["crew_b"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      dig_postcards: {
        Row: {
          cells: string[]
          cheered_at: string | null
          created_at: string
          digs: number
          feeding_number: number
          finds: number
          golden_in_digs: number | null
          id: string
          recipient_id: string
          recipient_opened_at: string | null
          sender_id: string
        }
        Insert: {
          cells: string[]
          cheered_at?: string | null
          created_at?: string
          digs: number
          feeding_number: number
          finds: number
          golden_in_digs?: number | null
          id?: string
          recipient_id: string
          recipient_opened_at?: string | null
          sender_id: string
        }
        Update: {
          cells?: string[]
          cheered_at?: string | null
          created_at?: string
          digs?: number
          feeding_number?: number
          finds?: number
          golden_in_digs?: number | null
          id?: string
          recipient_id?: string
          recipient_opened_at?: string | null
          sender_id?: string
        }
        Relationships: []
      }
      dig_share_taps: {
        Row: {
          day: string
          taps: number
        }
        Insert: {
          day?: string
          taps?: number
        }
        Update: {
          day?: string
          taps?: number
        }
        Relationships: []
      }
      echo_claims: {
        Row: {
          claimed_at: string
          event_id: number
          user_id: string
        }
        Insert: {
          claimed_at?: string
          event_id: number
          user_id: string
        }
        Update: {
          claimed_at?: string
          event_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "echo_claims_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "echo_events"
            referencedColumns: ["id"]
          },
        ]
      }
      echo_events: {
        Row: {
          created_at: string
          crew_id: string
          id: number
          kind: string
          source_user: string
        }
        Insert: {
          created_at?: string
          crew_id: string
          id?: never
          kind?: string
          source_user: string
        }
        Update: {
          created_at?: string
          crew_id?: string
          id?: never
          kind?: string
          source_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "echo_events_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          source: string
          status: string
          user_id: string | null
          username: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind: string
          source: string
          status?: string
          user_id?: string | null
          username: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          source?: string
          status?: string
          user_id?: string | null
          username?: string
        }
        Relationships: []
      }
      field_guide_pages: {
        Row: {
          page_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          page_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          page_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      friend_favorites: {
        Row: {
          created_at: string
          friend_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          receiver_id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          receiver_id: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          receiver_id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      golden_barn_finds: {
        Row: {
          found_on: string
          user_id: string
        }
        Insert: {
          found_on: string
          user_id: string
        }
        Update: {
          found_on?: string
          user_id?: string
        }
        Relationships: []
      }
      golden_truffle_overflow: {
        Row: {
          amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hats: {
        Row: {
          category: string
          cost: number
          created_at: string
          description: string | null
          display_order: number
          emoji: string | null
          id: string
          image_path: string | null
          members_only: boolean
          name: string
          pass_exclusive: boolean
          prestige_exclusive: boolean
          rarity: string
          token_cost: number | null
          war_exclusive: boolean
        }
        Insert: {
          category?: string
          cost: number
          created_at?: string
          description?: string | null
          display_order?: number
          emoji?: string | null
          id: string
          image_path?: string | null
          members_only?: boolean
          name: string
          pass_exclusive?: boolean
          prestige_exclusive?: boolean
          rarity?: string
          token_cost?: number | null
          war_exclusive?: boolean
        }
        Update: {
          category?: string
          cost?: number
          created_at?: string
          description?: string | null
          display_order?: number
          emoji?: string | null
          id?: string
          image_path?: string | null
          members_only?: boolean
          name?: string
          pass_exclusive?: boolean
          prestige_exclusive?: boolean
          rarity?: string
          token_cost?: number | null
          war_exclusive?: boolean
        }
        Relationships: []
      }
      hunger_drain: {
        Row: {
          id: boolean
          total: number
        }
        Insert: {
          id?: boolean
          total?: number
        }
        Update: {
          id?: boolean
          total?: number
        }
        Relationships: []
      }
      hunger_stage_rewards: {
        Row: {
          granted_at: string
          reward: number
          stage_key: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          reward?: number
          stage_key: string
          user_id: string
        }
        Update: {
          granted_at?: string
          reward?: number
          stage_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hunger_stage_rewards_stage_key_fkey"
            columns: ["stage_key"]
            isOneToOne: false
            referencedRelation: "hunger_stage_unlocks"
            referencedColumns: ["stage_key"]
          },
        ]
      }
      hunger_stage_unlocks: {
        Row: {
          reached_at: string
          stage_key: string
          threshold: number
        }
        Insert: {
          reached_at?: string
          stage_key: string
          threshold: number
        }
        Update: {
          reached_at?: string
          stage_key?: string
          threshold?: number
        }
        Relationships: []
      }
      interaction_analytics_events: {
        Row: {
          content_id: string | null
          event_name: string
          experiment: string | null
          id: number
          occurred_at: string
          properties: Json
          result: string | null
          session_id: string
          surface: string
          target_kind: string | null
          target_user_id: string | null
          user_id: string
        }
        Insert: {
          content_id?: string | null
          event_name: string
          experiment?: string | null
          id?: never
          occurred_at?: string
          properties?: Json
          result?: string | null
          session_id: string
          surface: string
          target_kind?: string | null
          target_user_id?: string | null
          user_id: string
        }
        Update: {
          content_id?: string | null
          event_name?: string
          experiment?: string | null
          id?: never
          occurred_at?: string
          properties?: Json
          result?: string | null
          session_id?: string
          surface?: string
          target_kind?: string | null
          target_user_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      item_drive_donations: {
        Row: {
          created_at: string
          donor_user_id: string
          drive_id: string
          id: string
          reward_claimed_at: string | null
          snouts: number
          tickle_reward: number
        }
        Insert: {
          created_at?: string
          donor_user_id: string
          drive_id: string
          id?: string
          reward_claimed_at?: string | null
          snouts: number
          tickle_reward: number
        }
        Update: {
          created_at?: string
          donor_user_id?: string
          drive_id?: string
          id?: string
          reward_claimed_at?: string | null
          snouts?: number
          tickle_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_drive_donations_drive_id_fkey"
            columns: ["drive_id"]
            isOneToOne: false
            referencedRelation: "item_drives"
            referencedColumns: ["id"]
          },
        ]
      }
      item_drives: {
        Row: {
          closes_at: string
          granted_at: string | null
          id: string
          item_id: string
          last_nudge_at: string | null
          opener_user_id: string
          opens_at: string
          raised_snouts: number
          status: string
          target_snouts: number
        }
        Insert: {
          closes_at: string
          granted_at?: string | null
          id?: string
          item_id: string
          last_nudge_at?: string | null
          opener_user_id: string
          opens_at?: string
          raised_snouts?: number
          status?: string
          target_snouts: number
        }
        Update: {
          closes_at?: string
          granted_at?: string | null
          id?: string
          item_id?: string
          last_nudge_at?: string | null
          opener_user_id?: string
          opens_at?: string
          raised_snouts?: number
          status?: string
          target_snouts?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_drives_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "hats"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_events: {
        Row: {
          created_at: string
          id: number
          passed_id: string
          passed_tickles: number
          passer_id: string
          passer_tickles: number
          seen_at: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          passed_id: string
          passed_tickles: number
          passer_id: string
          passer_tickles: number
          seen_at?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          passed_id?: string
          passed_tickles?: number
          passer_id?: string
          passer_tickles?: number
          seen_at?: string | null
        }
        Relationships: []
      }
      lucky_pig_hits: {
        Row: {
          claimed_at: string
          id: number
          user_id: string
        }
        Insert: {
          claimed_at?: string
          id?: never
          user_id: string
        }
        Update: {
          claimed_at?: string
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      onboarding_claims: {
        Row: {
          claimed_at: string
          milestone_id: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          milestone_id: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          milestone_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_claims_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "onboarding_milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_milestones: {
        Row: {
          description: string
          display_order: number
          icon: string | null
          id: string
          name: string
          reward_snouts: number
        }
        Insert: {
          description: string
          display_order?: number
          icon?: string | null
          id: string
          name: string
          reward_snouts?: number
        }
        Update: {
          description?: string
          display_order?: number
          icon?: string | null
          id?: string
          name?: string
          reward_snouts?: number
        }
        Relationships: []
      }
      pair_bonds: {
        Row: {
          blessings: number
          bond: number | null
          curses: number
          trades: number
          updated_at: string
          user_a: string
          user_b: string
          visits: number
        }
        Insert: {
          blessings?: number
          bond?: number | null
          curses?: number
          trades?: number
          updated_at?: string
          user_a: string
          user_b: string
          visits?: number
        }
        Update: {
          blessings?: number
          bond?: number | null
          curses?: number
          trades?: number
          updated_at?: string
          user_a?: string
          user_b?: string
          visits?: number
        }
        Relationships: []
      }
      pig_catalog: {
        Row: {
          available: boolean
          coat: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          available?: boolean
          coat: string
          id: string
          name: string
          sort_order: number
        }
        Update: {
          available?: boolean
          coat?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      porch_round_stops: {
        Row: {
          created_at: string
          id: number
          page_number: number
          stop_number: number
          target_id: string
          visit_started_at: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          page_number: number
          stop_number: number
          target_id: string
          visit_started_at: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: number
          page_number?: number
          stop_number?: number
          target_id?: string
          visit_started_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_aura_id: string | null
          active_background_id: string | null
          active_flag_id: string | null
          active_glasses_id: string | null
          active_hat_id: string | null
          active_held_id: string | null
          active_mask_id: string | null
          active_neck_id: string | null
          active_pig_id: string
          active_tickle_particle_id: string | null
          active_title_id: string | null
          alignment_max_neg: number
          alignment_max_pos: number
          alignment_score: number
          alignment_updated_at: string
          allegiance_chosen_at: string | null
          allegiance_country: string | null
          avatar_url: string | null
          barn_visit_window_start: string | null
          beginners_snout_at: string | null
          counter: number
          discriminator: string | null
          distinct_active_days: number
          expo_push_token: string | null
          feature_overrides: Json
          full_name: string | null
          golden_truffles: number
          happiness: number
          happiness_updated_at: string
          happiness_window_gain: number
          happiness_window_start: string
          hide_from_leaderboard: boolean
          id: string
          is_test: boolean
          is_vip: boolean
          last_active_date: string | null
          last_stipend_month: string | null
          push_permission_granted: boolean
          referral_code: string | null
          referral_completed_at: string | null
          referral_redeemed_at: string | null
          referrals_completed: number
          referred_by: string | null
          renames_used: number
          schism_seen_angel_at: string | null
          schism_seen_goblin_at: string | null
          seen_67_at: string | null
          slop_club_grant_until: string | null
          storybook_seen: boolean
          tickles_earned: number
          tickles_lifetime_base: number
          tickles_wasted_total: number
          updated_at: string | null
          username: string | null
          vip_until: string | null
          wallow_count: number
          war_wins: number
          website: string | null
        }
        Insert: {
          active_aura_id?: string | null
          active_background_id?: string | null
          active_flag_id?: string | null
          active_glasses_id?: string | null
          active_hat_id?: string | null
          active_held_id?: string | null
          active_mask_id?: string | null
          active_neck_id?: string | null
          active_pig_id?: string
          active_tickle_particle_id?: string | null
          active_title_id?: string | null
          alignment_max_neg?: number
          alignment_max_pos?: number
          alignment_score?: number
          alignment_updated_at?: string
          allegiance_chosen_at?: string | null
          allegiance_country?: string | null
          avatar_url?: string | null
          barn_visit_window_start?: string | null
          beginners_snout_at?: string | null
          counter?: number
          discriminator?: string | null
          distinct_active_days?: number
          expo_push_token?: string | null
          feature_overrides?: Json
          full_name?: string | null
          golden_truffles?: number
          happiness?: number
          happiness_updated_at?: string
          happiness_window_gain?: number
          happiness_window_start?: string
          hide_from_leaderboard?: boolean
          id: string
          is_test?: boolean
          is_vip?: boolean
          last_active_date?: string | null
          last_stipend_month?: string | null
          push_permission_granted?: boolean
          referral_code?: string | null
          referral_completed_at?: string | null
          referral_redeemed_at?: string | null
          referrals_completed?: number
          referred_by?: string | null
          renames_used?: number
          schism_seen_angel_at?: string | null
          schism_seen_goblin_at?: string | null
          seen_67_at?: string | null
          slop_club_grant_until?: string | null
          storybook_seen?: boolean
          tickles_earned?: number
          tickles_lifetime_base?: number
          tickles_wasted_total?: number
          updated_at?: string | null
          username?: string | null
          vip_until?: string | null
          wallow_count?: number
          war_wins?: number
          website?: string | null
        }
        Update: {
          active_aura_id?: string | null
          active_background_id?: string | null
          active_flag_id?: string | null
          active_glasses_id?: string | null
          active_hat_id?: string | null
          active_held_id?: string | null
          active_mask_id?: string | null
          active_neck_id?: string | null
          active_pig_id?: string
          active_tickle_particle_id?: string | null
          active_title_id?: string | null
          alignment_max_neg?: number
          alignment_max_pos?: number
          alignment_score?: number
          alignment_updated_at?: string
          allegiance_chosen_at?: string | null
          allegiance_country?: string | null
          avatar_url?: string | null
          barn_visit_window_start?: string | null
          beginners_snout_at?: string | null
          counter?: number
          discriminator?: string | null
          distinct_active_days?: number
          expo_push_token?: string | null
          feature_overrides?: Json
          full_name?: string | null
          golden_truffles?: number
          happiness?: number
          happiness_updated_at?: string
          happiness_window_gain?: number
          happiness_window_start?: string
          hide_from_leaderboard?: boolean
          id?: string
          is_test?: boolean
          is_vip?: boolean
          last_active_date?: string | null
          last_stipend_month?: string | null
          push_permission_granted?: boolean
          referral_code?: string | null
          referral_completed_at?: string | null
          referral_redeemed_at?: string | null
          referrals_completed?: number
          referred_by?: string | null
          renames_used?: number
          schism_seen_angel_at?: string | null
          schism_seen_goblin_at?: string | null
          seen_67_at?: string | null
          slop_club_grant_until?: string | null
          storybook_seen?: boolean
          tickles_earned?: number
          tickles_lifetime_base?: number
          tickles_wasted_total?: number
          updated_at?: string | null
          username?: string | null
          vip_until?: string | null
          wallow_count?: number
          war_wins?: number
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_aura_id_fkey"
            columns: ["active_aura_id"]
            isOneToOne: false
            referencedRelation: "hats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_active_background_id_fkey"
            columns: ["active_background_id"]
            isOneToOne: false
            referencedRelation: "hats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_active_flag_id_fkey"
            columns: ["active_flag_id"]
            isOneToOne: false
            referencedRelation: "hats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_active_glasses_id_fkey"
            columns: ["active_glasses_id"]
            isOneToOne: false
            referencedRelation: "hats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_active_hat_id_fkey"
            columns: ["active_hat_id"]
            isOneToOne: false
            referencedRelation: "hats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_active_held_id_fkey"
            columns: ["active_held_id"]
            isOneToOne: false
            referencedRelation: "hats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_active_mask_id_fkey"
            columns: ["active_mask_id"]
            isOneToOne: false
            referencedRelation: "hats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_active_neck_id_fkey"
            columns: ["active_neck_id"]
            isOneToOne: false
            referencedRelation: "hats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_active_pig_id_fkey"
            columns: ["active_pig_id"]
            isOneToOne: false
            referencedRelation: "pig_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_active_tickle_particle_id_fkey"
            columns: ["active_tickle_particle_id"]
            isOneToOne: false
            referencedRelation: "hats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_active_title_id_fkey"
            columns: ["active_title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_allegiance_country_fkey"
            columns: ["allegiance_country"]
            isOneToOne: false
            referencedRelation: "hats"
            referencedColumns: ["id"]
          },
        ]
      }
      race_digs: {
        Row: {
          crew_id: string
          cycle_key: string
          finds: number
          user_id: string
          window_index: number
        }
        Insert: {
          crew_id: string
          cycle_key: string
          finds?: number
          user_id: string
          window_index: number
        }
        Update: {
          crew_id?: string
          cycle_key?: string
          finds?: number
          user_id?: string
          window_index?: number
        }
        Relationships: []
      }
      race_podium_queue: {
        Row: {
          hat_id: string
          id: number
          note: string | null
        }
        Insert: {
          hat_id: string
          id?: number
          note?: string | null
        }
        Update: {
          hat_id?: string
          id?: number
          note?: string | null
        }
        Relationships: []
      }
      redemption_claims: {
        Row: {
          claimed_at: string
          code: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          code: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redemption_claims_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "redemption_codes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "redemption_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      redemption_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          grant: Json
          label: string
          max_uses: number
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          grant: Json
          label: string
          max_uses?: number
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          grant?: Json
          label?: string
          max_uses?: number
          uses?: number
        }
        Relationships: []
      }
      referral_milestones: {
        Row: {
          granted_at: string
          id: string
          milestone: string
          referee_id: string
          referrer_id: string
          snouts_referee: number
          snouts_referrer: number
        }
        Insert: {
          granted_at?: string
          id?: string
          milestone: string
          referee_id: string
          referrer_id: string
          snouts_referee?: number
          snouts_referrer?: number
        }
        Update: {
          granted_at?: string
          id?: string
          milestone?: string
          referee_id?: string
          referrer_id?: string
          snouts_referee?: number
          snouts_referrer?: number
        }
        Relationships: []
      }
      season_finales: {
        Row: {
          bracket: string
          final_score: number
          finalized_at: string
          season_key: string
          seen_at: string | null
          side: string
          side_rank: number | null
          snouts: number
          title_id: string | null
          user_id: string
        }
        Insert: {
          bracket: string
          final_score: number
          finalized_at?: string
          season_key: string
          seen_at?: string | null
          side: string
          side_rank?: number | null
          snouts?: number
          title_id?: string | null
          user_id: string
        }
        Update: {
          bracket?: string
          final_score?: number
          finalized_at?: string
          season_key?: string
          seen_at?: string | null
          side?: string
          side_rank?: number | null
          snouts?: number
          title_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_finales_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      season_tiers: {
        Row: {
          display_label: string
          reward_type: string
          reward_value: Json
          season_id: string
          tier: number
          track: string
        }
        Insert: {
          display_label: string
          reward_type: string
          reward_value: Json
          season_id: string
          tier: number
          track: string
        }
        Update: {
          display_label?: string
          reward_type?: string
          reward_value?: Json
          season_id?: string
          tier?: number
          track?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_tiers_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      season0_tickle_standings: {
        Row: {
          hidden: boolean
          rank: number | null
          snapshotted_at: string
          tickles_earned: number
          user_id: string
          username: string | null
        }
        Insert: {
          hidden?: boolean
          rank?: number | null
          snapshotted_at?: string
          tickles_earned: number
          user_id: string
          username?: string | null
        }
        Update: {
          hidden?: boolean
          rank?: number | null
          snapshotted_at?: string
          tickles_earned?: number
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      seasons: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          name: string
          premium_plus_price_cents: number
          premium_price_cents: number
          starts_at: string
          total_tiers: number
          xp_per_tier: number
        }
        Insert: {
          created_at?: string
          ends_at: string
          id: string
          name: string
          premium_plus_price_cents?: number
          premium_price_cents?: number
          starts_at: string
          total_tiers?: number
          xp_per_tier?: number
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          name?: string
          premium_plus_price_cents?: number
          premium_price_cents?: number
          starts_at?: string
          total_tiers?: number
          xp_per_tier?: number
        }
        Relationships: []
      }
      system_announcements: {
        Row: {
          body: string
          data: Json
          dispatched_at: string
          id: number
          kind: string
          seen_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          data?: Json
          dispatched_at?: string
          id?: number
          kind: string
          seen_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          data?: Json
          dispatched_at?: string
          id?: number
          kind?: string
          seen_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      tickle_trades: {
        Row: {
          amount: number
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          fulfilled_at: string | null
          id: string
          repaid_at: string | null
          requester_id: string
          status: string
          target_id: string
        }
        Insert: {
          amount: number
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          fulfilled_at?: string | null
          id?: string
          repaid_at?: string | null
          requester_id: string
          status?: string
          target_id: string
        }
        Update: {
          amount?: number
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          fulfilled_at?: string | null
          id?: string
          repaid_at?: string | null
          requester_id?: string
          status?: string
          target_id?: string
        }
        Relationships: []
      }
      titles: {
        Row: {
          cost: number | null
          created_at: string
          description: string | null
          display_order: number | null
          for_sale: boolean
          id: string
          name: string
          placement: string
          rarity: string | null
          source: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          for_sale?: boolean
          id: string
          name: string
          placement?: string
          rarity?: string | null
          source?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          for_sale?: boolean
          id?: string
          name?: string
          placement?: string
          rarity?: string | null
          source?: string | null
        }
        Relationships: []
      }
      truffle_digs: {
        Row: {
          amount: number
          digger_id: string
          dug_at: string
          id: number
          truffle_id: number
        }
        Insert: {
          amount: number
          digger_id: string
          dug_at?: string
          id?: number
          truffle_id: number
        }
        Update: {
          amount?: number
          digger_id?: string
          dug_at?: string
          id?: number
          truffle_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "truffle_digs_truffle_id_fkey"
            columns: ["truffle_id"]
            isOneToOne: false
            referencedRelation: "truffles"
            referencedColumns: ["id"]
          },
        ]
      }
      truffles: {
        Row: {
          buried_at: string
          dug_at: string | null
          dug_by: string | null
          host_id: string
          id: number
          reclaimed_at: string | null
          remaining: number
          reward: number
        }
        Insert: {
          buried_at?: string
          dug_at?: string | null
          dug_by?: string | null
          host_id: string
          id?: number
          reclaimed_at?: string | null
          remaining?: number
          reward: number
        }
        Update: {
          buried_at?: string
          dug_at?: string | null
          dug_by?: string | null
          host_id?: string
          id?: number
          reclaimed_at?: string | null
          remaining?: number
          reward?: number
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          claimed_at: string
          level: number
          progress: number
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          achievement_id: string
          claimed_at?: string
          level?: number
          progress?: number
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          achievement_id?: string
          claimed_at?: string
          level?: number
          progress?: number
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      user_bounty_claims: {
        Row: {
          bounty_code: string
          claimed_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          bounty_code: string
          claimed_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          bounty_code?: string
          claimed_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      user_bounty_notified: {
        Row: {
          bounty_code: string
          notified_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          bounty_code: string
          notified_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          bounty_code?: string
          notified_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      user_bounty_rerolls: {
        Row: {
          new_code: string
          rerolled_at: string
          slot_code: string
          snouts_paid: number
          user_id: string
          week_start: string
        }
        Insert: {
          new_code: string
          rerolled_at?: string
          slot_code: string
          snouts_paid?: number
          user_id: string
          week_start: string
        }
        Update: {
          new_code?: string
          rerolled_at?: string
          slot_code?: string
          snouts_paid?: number
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      user_hats: {
        Row: {
          acquired_at: string
          hat_id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          hat_id: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          hat_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_hats_hat_id_fkey"
            columns: ["hat_id"]
            isOneToOne: false
            referencedRelation: "hats"
            referencedColumns: ["id"]
          },
        ]
      }
      user_items: {
        Row: {
          item_count: number | null
          last_increment: string | null
          user_id: string
        }
        Insert: {
          item_count?: number | null
          last_increment?: string | null
          user_id: string
        }
        Update: {
          item_count?: number | null
          last_increment?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_patch_carry: {
        Row: {
          gild: number
          kind: string
          unique_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          gild?: number
          kind: string
          unique_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          gild?: number
          kind?: string
          unique_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_pigs: {
        Row: {
          pig_id: string
          recruited_at: string
          user_id: string
        }
        Insert: {
          pig_id: string
          recruited_at?: string
          user_id: string
        }
        Update: {
          pig_id?: string
          recruited_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pigs_pig_id_fkey"
            columns: ["pig_id"]
            isOneToOne: false
            referencedRelation: "pig_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_pigs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reports: {
        Row: {
          created_at: string
          id: number
          reason: string
          reported_id: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          reason: string
          reported_id: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          id?: number
          reason?: string
          reported_id?: string
          reporter_id?: string
        }
        Relationships: []
      }
      user_schism_seen: {
        Row: {
          milestone: number
          seen_at: string
          side: string
          user_id: string
        }
        Insert: {
          milestone: number
          seen_at?: string
          side: string
          user_id: string
        }
        Update: {
          milestone?: number
          seen_at?: string
          side?: string
          user_id?: string
        }
        Relationships: []
      }
      user_season_progress: {
        Row: {
          premium_plus_unlocked: boolean
          premium_unlocked: boolean
          season_id: string
          user_id: string
          wallow_count: number
          xp: number
        }
        Insert: {
          premium_plus_unlocked?: boolean
          premium_unlocked?: boolean
          season_id: string
          user_id: string
          wallow_count?: number
          xp?: number
        }
        Update: {
          premium_plus_unlocked?: boolean
          premium_unlocked?: boolean
          season_id?: string
          user_id?: string
          wallow_count?: number
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_season_progress_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tier_claims: {
        Row: {
          claimed_at: string
          season_id: string
          tier: number
          track: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          season_id: string
          tier: number
          track: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          season_id?: string
          tier?: number
          track?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tier_claims_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_titles: {
        Row: {
          awarded_at: string
          title_id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          title_id: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          title_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_titles_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_uniques: {
        Row: {
          best_gild: number
          first_found_at: string
          found_count: number
          unique_id: string
          user_id: string
        }
        Insert: {
          best_gild?: number
          first_found_at?: string
          found_count?: number
          unique_id: string
          user_id: string
        }
        Update: {
          best_gild?: number
          first_found_at?: string
          found_count?: number
          unique_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_wallow_tier_claims: {
        Row: {
          claimed_at: string
          season_id: string
          tier: number
          user_id: string
          wallow_lap: number
        }
        Insert: {
          claimed_at?: string
          season_id: string
          tier: number
          user_id: string
          wallow_lap: number
        }
        Update: {
          claimed_at?: string
          season_id?: string
          tier?: number
          user_id?: string
          wallow_lap?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_wallow_tier_claims_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_wallow_tier_claims_tier_fkey"
            columns: ["tier"]
            isOneToOne: false
            referencedRelation: "wallow_tiers"
            referencedColumns: ["tier"]
          },
        ]
      }
      visit_emotes: {
        Row: {
          created_at: string
          emote_id: string
          host_id: string
          id: number
          visit_started_at: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          emote_id: string
          host_id: string
          id?: number
          visit_started_at: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          emote_id?: string
          host_id?: string
          id?: number
          visit_started_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      wallow_rank_rewards: {
        Row: {
          hat_id: string
          rank: number
        }
        Insert: {
          hat_id: string
          rank: number
        }
        Update: {
          hat_id?: string
          rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "wallow_rank_rewards_hat_id_fkey"
            columns: ["hat_id"]
            isOneToOne: false
            referencedRelation: "hats"
            referencedColumns: ["id"]
          },
        ]
      }
      wallow_tiers: {
        Row: {
          display_label: string
          reward_type: string
          reward_value: Json
          tier: number
        }
        Insert: {
          display_label: string
          reward_type: string
          reward_value: Json
          tier: number
        }
        Update: {
          display_label?: string
          reward_type?: string
          reward_value?: Json
          tier?: number
        }
        Relationships: []
      }
      war_rootings: {
        Row: {
          actions: number | null
          credited_finds: number
          crew_id: string
          dig_day: string
          echo_credited: boolean
          finds: string[] | null
          hunger_stage_key: string | null
          opened_at: string
          seed: number
          submitted_at: string | null
          truffles_minted: number
          unique_id: string | null
          user_id: string
          window_index: number
        }
        Insert: {
          actions?: number | null
          credited_finds?: number
          crew_id: string
          dig_day: string
          echo_credited?: boolean
          finds?: string[] | null
          hunger_stage_key?: string | null
          opened_at?: string
          seed: number
          submitted_at?: string | null
          truffles_minted?: number
          unique_id?: string | null
          user_id: string
          window_index: number
        }
        Update: {
          actions?: number | null
          credited_finds?: number
          crew_id?: string
          dig_day?: string
          echo_credited?: boolean
          finds?: string[] | null
          hunger_stage_key?: string | null
          opened_at?: string
          seed?: number
          submitted_at?: string | null
          truffles_minted?: number
          unique_id?: string | null
          user_id?: string
          window_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "war_rootings_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      war_truffles: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          user_id: string
          war_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason: string
          user_id: string
          war_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
          war_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      user_trade_given: {
        Row: {
          amount: number | null
          user_id: string | null
        }
        Relationships: []
      }
      user_trade_received: {
        Row: {
          amount: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _barn_visit_status_before_prestige_window: {
        Args: { p_target: string }
        Returns: Json
      }
      _claim_wallow_tier_cap_limited_20260784: {
        Args: { target_tier: number }
        Returns: Json
      }
      _feeding_sched: { Args: never; Returns: number[] }
      _patch_clock: {
        Args: { p_at: string }
        Returns: {
          dig_day: string
          opens_at: string
          phase_ends_at: string
          phase_open: boolean
          window_ends_at: string
          window_index: number
        }[]
      }
      _patch_now: { Args: never; Returns: string }
      _race_pay_cycle: { Args: { p_cycle: string }; Returns: boolean }
      _race_table: {
        Args: { p_cycle: string }
        Returns: {
          avg: number
          crew_id: string
          crew_name: string
          diggers: number
          rnk: number
          roster_size: number
          total_finds: number
        }[]
      }
      _race_tickles_for_rank: {
        Args: { p_rank: number; p_ranked: number }
        Returns: number
      }
      _race_truffles_for_rank: {
        Args: { p_rank: number; p_ranked: number }
        Returns: number
      }
      _regen_secs_for_wallow: {
        Args: { p_wallow_count: number; uid: string }
        Returns: number
      }
      _season_state_before_wallow_tuning: { Args: never; Returns: Json }
      _tickle_at_barn_before_prestige_window: {
        Args: { p_target: string }
        Returns: Json
      }
      _tickle_at_barn_before_security_lock: {
        Args: { p_target: string }
        Returns: Json
      }
      _tickle_at_barn_before_visit_emotes: {
        Args: { p_target: string }
        Returns: Json
      }
      _wallow_before_tuning: { Args: never; Returns: Json }
      _wallow_regen_percent: {
        Args: { p_wallow_count: number }
        Returns: number
      }
      _wallow_tuning: { Args: never; Returns: Json }
      _wallow_visit_hours: { Args: { p_wallow_count: number }; Returns: number }
      accept_crew_invite: { Args: { p_invite: string }; Returns: Json }
      accept_friend_request: { Args: { other_user_id: string }; Returns: Json }
      accept_join_request: { Args: { p_request: string }; Returns: Json }
      accepted_friend_count: { Args: { uid: string }; Returns: number }
      activate_pig: { Args: { target_pig_id: string }; Returns: Json }
      active_echo: { Args: never; Returns: Json }
      active_season: {
        Args: never
        Returns: {
          created_at: string
          ends_at: string
          id: string
          name: string
          premium_plus_price_cents: number
          premium_price_cents: number
          starts_at: string
          total_tiers: number
          xp_per_tier: number
        }
        SetofOptions: {
          from: "*"
          to: "seasons"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_feature_flag: {
        Args: { p_enabled: boolean; p_key: string }
        Returns: Json
      }
      admin_tickle_overview: {
        Args: never
        Returns: {
          active_hat_id: string
          active_hat_name: string
          alignment_score: number
          balance_now: number
          balance_raw: number
          cap: number
          created_at: string
          discriminator: string
          is_test: boolean
          last_increment: string
          next_regen_secs: number
          regen_secs: number
          tickles_earned: number
          user_id: string
          username: string
        }[]
      }
      alignment_label: { Args: { score: number }; Returns: string }
      alignment_leaderboard: {
        Args: { per_side?: number }
        Returns: {
          active_flag_id: string
          active_hat_id: string
          alignment_score: number
          side: string
          side_rank: number
          user_id: string
          username: string
        }[]
      }
      analytics_interaction_overview: {
        Args: { p_days?: number }
        Returns: Json
      }
      analytics_overview: { Args: never; Returns: Json }
      app_setting: { Args: { p_key: string }; Returns: Json }
      apply_happiness: {
        Args: { raw_gain: number; uid: string }
        Returns: undefined
      }
      are_blocked: { Args: { a: string; b: string }; Returns: boolean }
      are_friends: {
        Args: { user_a: string; user_b: string }
        Returns: boolean
      }
      barn_kindness_card_status: { Args: { p_host: string }; Returns: Json }
      barn_pair_locks: { Args: { p_targets: string[] }; Returns: Json }
      barn_visit_status: { Args: { p_target: string }; Returns: Json }
      block_user: { Args: { target_user_id: string }; Returns: Json }
      bounty_ready_count: { Args: never; Returns: number }
      bump_dig_share_count: { Args: never; Returns: undefined }
      bump_pair_bond: {
        Args: { p_col: string; p_x: string; p_y: string }
        Returns: undefined
      }
      bump_pair_enemy: {
        Args: { p_x: string; p_y: string }
        Returns: undefined
      }
      bury_truffle: { Args: { p_amount: number }; Returns: Json }
      buy_hat: { Args: { target_hat_id: string }; Returns: Json }
      buy_title: { Args: { target_title_id: string }; Returns: Json }
      cancel_crew_invite: { Args: { p_invite: string }; Returns: Json }
      cancel_friend_request: { Args: { target_user_id: string }; Returns: Json }
      cancel_join_request: { Args: { p_request: string }; Returns: Json }
      cancel_tickle_trade: { Args: { trade_id: string }; Returns: Json }
      check_schism_status: { Args: never; Returns: Json }
      cheer_dig_postcard: { Args: { p_postcard_id: string }; Returns: Json }
      choose_allegiance: { Args: { p_flag_id: string }; Returns: Json }
      claim_beginners_snout: { Args: never; Returns: Json }
      claim_bounty: { Args: { bounty_code: string }; Returns: Json }
      claim_drive_reward: { Args: { donation_id: string }; Returns: Json }
      claim_echo: { Args: never; Returns: Json }
      claim_onboarding: { Args: never; Returns: Json }
      claim_ready_tiers: { Args: { target_track?: string }; Returns: Json }
      claim_season_tier: {
        Args: { target_tier: number; target_track?: string }
        Returns: Json
      }
      claim_slop_stipend: { Args: never; Returns: Json }
      claim_tier_reward: {
        Args: { target_tier: number; target_track: string }
        Returns: Json
      }
      claim_wallow_tier: { Args: { target_tier: number }; Returns: Json }
      cleanse_curses: { Args: never; Returns: Json }
      clear_blessing: { Args: { target_kind: string }; Returns: Json }
      complete_referral_if_eligible: {
        Args: { invitee_id: string }
        Returns: boolean
      }
      create_crew: { Args: { p_name: string }; Returns: Json }
      create_dig_postcard: {
        Args: {
          p_cells: string[]
          p_digs: number
          p_feeding_number: number
          p_golden_in_digs?: number
          p_recipient_id: string
        }
        Returns: Json
      }
      crew_state: { Args: never; Returns: Json }
      current_week_start: { Args: never; Returns: string }
      daily_blessing_kind: { Args: never; Returns: string }
      daily_curse_kind: { Args: never; Returns: string }
      daily_shop: {
        Args: never
        Returns: {
          category: string
          cost: number
          created_at: string
          description: string | null
          display_order: number
          emoji: string | null
          id: string
          image_path: string | null
          members_only: boolean
          name: string
          pass_exclusive: boolean
          prestige_exclusive: boolean
          rarity: string
          token_cost: number | null
          war_exclusive: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "hats"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      decline_crew_invite: { Args: { p_invite: string }; Returns: Json }
      decline_join_request: { Args: { p_request: string }; Returns: Json }
      delete_my_account: { Args: never; Returns: Json }
      dev_grant_title: { Args: { target_title_id: string }; Returns: Json }
      dev_send_push: {
        Args: {
          push_body?: string
          push_title?: string
          target_user_id: string
        }
        Returns: Json
      }
      dev_set_vip: { Args: { target: boolean }; Returns: Json }
      dev_unlock_premium: { Args: { plus?: boolean }; Returns: Json }
      dig_truffle: { Args: { p_host: string }; Returns: Json }
      donate_to_drive: {
        Args: { drive_id: string; snouts: number }
        Returns: Json
      }
      enemy_leaderboard: { Args: { p_limit?: number }; Returns: Json }
      equip_cosmetic: {
        Args: { p_category?: string; p_item_id: string }
        Returns: Json
      }
      equip_title: { Args: { target_title_id: string }; Returns: Json }
      exchange_rotation: { Args: never; Returns: Json }
      exchange_week_stock: { Args: { p_week: string }; Returns: string[] }
      feature_flags: { Args: never; Returns: Json }
      feedback_dump: { Args: { p_secret: string }; Returns: Json }
      feedback_mark: {
        Args: { p_ids: string[]; p_secret: string; p_status: string }
        Returns: Json
      }
      feeding_state: { Args: never; Returns: Json }
      finalize_season: { Args: { season_key?: string }; Returns: Json }
      find_joinable_crews: { Args: never; Returns: Json }
      friend_ids: { Args: never; Returns: string[] }
      friends_crews: { Args: never; Returns: Json }
      fulfill_tickle_trade: { Args: { trade_id: string }; Returns: Json }
      generate_referral_code: { Args: { uid: string }; Returns: string }
      generate_unique_discriminator: {
        Args: { target_username: string }
        Returns: string
      }
      get_field_guide_pages: { Args: never; Returns: string[] }
      get_storybook_seen: { Args: never; Returns: boolean }
      graduate_season0_probe: { Args: never; Returns: string }
      grant_beta_rewards: { Args: never; Returns: Json }
      grant_mystery_box: {
        Args: { box_kind?: string; target_user: string }
        Returns: Json
      }
      grant_reached_hunger_stage_rewards: {
        Args: { p_send_push?: boolean }
        Returns: number
      }
      grant_season_pass: { Args: never; Returns: Json }
      grant_season_xp: {
        Args: { amount: number; uid: string }
        Returns: undefined
      }
      grant_season1_finale: { Args: never; Returns: Json }
      grant_tickles: { Args: { n: number; uid: string }; Returns: number }
      happiness_now: { Args: { uid: string }; Returns: number }
      has_season_pass: { Args: never; Returns: boolean }
      home_stats: { Args: never; Returns: Json }
      hunger_meter: { Args: never; Returns: Json }
      increment_counter: { Args: { user_id: string }; Returns: undefined }
      invite_to_crew: { Args: { p_invitee: string }; Returns: Json }
      is_crew_member: {
        Args: { p_crew: string; p_user: string }
        Returns: boolean
      }
      is_crewmates: {
        Args: { user_a: string; user_b: string }
        Returns: boolean
      }
      is_username_allowed: { Args: { p_name: string }; Returns: boolean }
      join_crew: { Args: { p_crew: string }; Returns: Json }
      kick_crew_member: { Args: { p_member: string }; Returns: Json }
      leave_barn_guestbook_stamp: {
        Args: { p_host: string; p_stamp_id?: string }
        Returns: Json
      }
      leave_barn_kindness_card: { Args: { p_host: string }; Returns: Json }
      leave_crew: { Args: never; Returns: Json }
      leave_visit_emote: {
        Args: { p_emote_id: string; p_host: string }
        Returns: Json
      }
      lucky_bonus_tickle: { Args: never; Returns: Json }
      lucky_today: { Args: never; Returns: Json }
      mark_67_seen: { Args: never; Returns: Json }
      mark_achievement_viewed: { Args: { target_id: string }; Returns: Json }
      mark_all_pass_events_seen: { Args: never; Returns: Json }
      mark_announcement_seen: {
        Args: { announcement_id: number }
        Returns: Json
      }
      mark_finale_seen: { Args: { target_season_key: string }; Returns: Json }
      mark_pass_event_seen: { Args: { event_id: number }; Returns: Json }
      mark_schism_seen:
        | { Args: { side: string }; Returns: Json }
        | { Args: { milestone: number; side: string }; Returns: Json }
      mark_storybook_seen: { Args: never; Returns: undefined }
      me_lifetime_stats: { Args: never; Returns: Json }
      mint_truffles: {
        Args: {
          p_amount: number
          p_reason: string
          p_user: string
          p_war: string
        }
        Returns: number
      }
      my_achievements: {
        Args: never
        Returns: {
          category: string
          claimed: boolean
          description: string
          display_category: string
          display_order: number
          icon: string
          id: string
          is_top_tier: boolean
          level: number
          name: string
          progress: number
          reward_item_id: string
          reward_snouts: number
          reward_title_id: string
          threshold: number
          tier: number
          viewed_at: string
        }[]
      }
      my_achievements_pre_relics: {
        Args: never
        Returns: {
          category: string
          claimed: boolean
          description: string
          display_category: string
          display_order: number
          icon: string
          id: string
          is_top_tier: boolean
          level: number
          name: string
          progress: number
          reward_item_id: string
          reward_snouts: number
          reward_title_id: string
          threshold: number
          tier: number
          viewed_at: string
        }[]
      }
      my_active_effects: {
        Args: never
        Returns: {
          expires_at: string
          kind: string
          sender_id: string
          sender_username: string
          source: string
        }[]
      }
      my_barn_guestbook: { Args: { p_limit?: number }; Returns: Json }
      my_beta_reward: { Args: never; Returns: Json }
      my_dig_postcards: { Args: { p_limit?: number }; Returns: Json }
      my_drives: { Args: never; Returns: Json }
      my_finale_result: { Args: never; Returns: Json }
      my_porch_round: { Args: { p_limit?: number }; Returns: Json }
      my_referral_summary: { Args: never; Returns: Json }
      my_sounder: { Args: never; Returns: Json }
      my_tickle_trades: {
        Args: never
        Returns: {
          amount: number
          created_at: string
          fulfilled_at: string
          id: string
          partner_discriminator: string
          partner_username: string
          requester_id: string
          status: string
          target_id: string
        }[]
      }
      my_unclaimed_achievement_count: { Args: never; Returns: number }
      my_unseen_announcements: {
        Args: never
        Returns: {
          body: string
          data: Json
          dispatched_at: string
          id: number
          kind: string
          title: string
        }[]
      }
      my_weekly_bounties: {
        Args: never
        Returns: {
          claimed: boolean
          code: string
          description: string
          goal: number
          name: string
          progress: number
          rerolled: boolean
          reward_snouts: number
          slot_code: string
        }[]
      }
      notify_ready_bounties: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      nudge_trough: { Args: { p_drive_id: string }; Returns: Json }
      onboarding_done: {
        Args: { uid: string }
        Returns: {
          done: boolean
          milestone_id: string
        }[]
      }
      onboarding_progress: {
        Args: never
        Returns: {
          claimed: boolean
          description: string
          display_order: number
          done: boolean
          icon: string
          id: string
          name: string
          reward_snouts: number
        }[]
      }
      open_dig_postcards: { Args: { p_ids: string[] }; Returns: Json }
      open_item_drive: {
        Args: { seed_snouts: number; target_item_id: string }
        Returns: Json
      }
      open_rooting: { Args: never; Returns: Json }
      pair_bond_with: { Args: { p_other: string }; Returns: Json }
      pair_leaderboard: { Args: { p_limit?: number }; Returns: Json }
      patch_phase_open: { Args: { p_at: string }; Returns: boolean }
      pig_roster: { Args: never; Returns: Json }
      public_user_stats: {
        Args: { target_user_id: string }
        Returns: {
          active_hat_id: string
          active_title_id: string
          active_title_name: string
          active_title_placement: string
          alignment_label: string
          alignment_score: number
          discriminator: string
          friendship_status: string
          generous_tier_name: string
          given_total: number
          greedy_tier_name: string
          received_total: number
          user_id: string
          username: string
        }[]
      }
      race_crew_detail: { Args: { p_crew_id: string }; Returns: Json }
      race_current_cycle: {
        Args: never
        Returns: {
          cycle_key: string
          ends_at: string
          starts_at: string
        }[]
      }
      race_cycle_at: {
        Args: { p_at: string }
        Returns: {
          cycle_key: string
          ends_at: string
          starts_at: string
        }[]
      }
      race_history: { Args: never; Returns: Json }
      race_standings: { Args: never; Returns: Json }
      random_crew_name: { Args: never; Returns: string }
      reclaim_truffle: { Args: never; Returns: Json }
      record_interaction_event: {
        Args: {
          p_content_id?: string
          p_event_name: string
          p_experiment?: string
          p_properties?: Json
          p_result?: string
          p_session_id: string
          p_surface: string
          p_target_kind?: string
          p_target_user_id?: string
        }
        Returns: Json
      }
      record_lucky_pig_hit: { Args: never; Returns: Json }
      record_porch_stop: { Args: { p_target: string }; Returns: Json }
      recruit_pig: { Args: { target_pig_id: string }; Returns: Json }
      redeem_code: { Args: { p_code: string }; Returns: Json }
      redeem_referral_code: { Args: { p_code: string }; Returns: Json }
      redeem_war_cosmetic: { Args: { target_hat_id: string }; Returns: Json }
      regen_secs_for: { Args: { uid: string }; Returns: number }
      relic_achievement_progress: {
        Args: { cat: string; target_user_id: string }
        Returns: number
      }
      remove_friendship: { Args: { other_user_id: string }; Returns: Json }
      rename_crew: { Args: { p_name: string }; Returns: Json }
      rename_username: { Args: { p_name: string }; Returns: Json }
      report_user: {
        Args: { reason?: string; target_user_id: string }
        Returns: Json
      }
      request_tickles: {
        Args: { amount: number; target_user_id: string }
        Returns: Json
      }
      request_to_join: { Args: { p_crew: string }; Returns: Json }
      reroll_bounty: { Args: { bounty_code: string }; Returns: Json }
      resolve_expired_drives: { Args: never; Returns: number }
      ritual_status: { Args: never; Returns: Json }
      roll_lucky_numbers: { Args: never; Returns: number[] }
      roll_unique:
        | { Args: never; Returns: string }
        | { Args: { p_user_id: string }; Returns: string }
      rooting_finds: { Args: { p_seed: number }; Returns: string[] }
      run_judgement_day_season0: { Args: never; Returns: undefined }
      search_users: {
        Args: { max_results?: number; prefix: string }
        Returns: {
          discriminator: string
          id: string
          tickles_earned: number
          username: string
        }[]
      }
      season_state: { Args: never; Returns: Json }
      send_blessing: { Args: { target_user_id: string }; Returns: Json }
      send_curse: { Args: { target_user_id: string }; Returns: Json }
      send_friend_request: {
        Args: { target_discriminator?: string; target_username: string }
        Returns: Json
      }
      send_push_to_user: {
        Args: {
          push_body: string
          push_data?: Json
          push_title: string
          target_user_id: string
        }
        Returns: Json
      }
      send_system_announcement: {
        Args: {
          body: string
          data?: Json
          kind: string
          target_user_id: string
          title: string
        }
        Returns: Json
      }
      set_push_token: { Args: { token: string }; Returns: Json }
      settle_tickles: { Args: { uid: string }; Returns: number }
      shift_alignment: {
        Args: { delta: number; target_user_id: string }
        Returns: number
      }
      shop_resets_in_seconds: { Args: never; Returns: number }
      shop_titles: {
        Args: never
        Returns: {
          cost: number
          description: string
          display_order: number
          id: string
          name: string
          owned: boolean
          placement: string
          rarity: string
        }[]
      }
      slop_stipend_status: { Args: never; Returns: Json }
      sounder_invite_candidates: {
        Args: { p_limit: number; p_search: string }
        Returns: {
          already_invited: boolean
          crew_name: string
          discriminator: string
          id: string
          in_crew: boolean
          truffles_dug: number
          username: string
        }[]
      }
      sounder_leaderboard: {
        Args: { limit_n?: number }
        Returns: {
          active_title_id: string
          discriminator: string
          engaged_count: number
          is_self: boolean
          rank: number
          user_id: string
          username: string
        }[]
      }
      strip_emoji: { Args: { s: string }; Returns: string }
      submit_feedback: {
        Args: { p_body: string; p_kind: string }
        Returns: Json
      }
      submit_feedback_web: {
        Args: {
          p_body: string
          p_honey?: string
          p_kind: string
          p_name: string
        }
        Returns: Json
      }
      submit_rooting:
        | { Args: { p_actions: number; p_finds: string[] }; Returns: Json }
        | {
            Args: { p_actions: number; p_finds: string[]; p_missed: string[] }
            Returns: Json
          }
      suggested_users: {
        Args: { limit_n?: number }
        Returns: {
          active_hat_id: string
          discriminator: string
          id: string
          tickles_earned: number
          username: string
        }[]
      }
      sweep_race: { Args: never; Returns: Json }
      target_curse_status: { Args: { target_id: string }; Returns: Json }
      tickle_at_barn: { Args: { p_target: string }; Returns: Json }
      tickle_balance: { Args: { uid: string }; Returns: number }
      tickle_breakdown: { Args: { p_user: string }; Returns: Json }
      tickle_info: { Args: { uid: string }; Returns: Json }
      tickle_trade_history: {
        Args: { other_user_id: string }
        Returns: {
          amount: number
          cancelled_at: string
          created_at: string
          direction: string
          fulfilled_at: string
          id: string
          repaid_at: string
          requester_id: string
          status: string
          target_id: string
        }[]
      }
      title_id_from_name: { Args: { display_name: string }; Returns: string }
      top_up_truffle: { Args: { p_amount: number }; Returns: Json }
      trade_given_total: { Args: { target_user_id: string }; Returns: number }
      trade_received_total: {
        Args: { target_user_id: string }
        Returns: number
      }
      transfer_crew_leadership: {
        Args: { p_new_leader: string }
        Returns: Json
      }
      truffle_status: { Args: never; Returns: Json }
      try_claim_achievements: {
        Args: { cat: string; target_user_id: string }
        Returns: Json
      }
      try_claim_achievements_pre_relics: {
        Args: { cat: string; target_user_id: string }
        Returns: Json
      }
      unblock_user: { Args: { target_user_id: string }; Returns: Json }
      unique_pool: {
        Args: never
        Returns: {
          unique_id: string
          weight: number
        }[]
      }
      unlock_field_guide_page: { Args: { p_page: string }; Returns: undefined }
      unlock_random_lucky_title: { Args: never; Returns: Json }
      unseen_pass_events: {
        Args: never
        Returns: {
          created_at: string
          id: number
          passed_tickles: number
          passer_id: string
          passer_tickles: number
          passer_username: string
        }[]
      }
      update_profile_and_item_count: { Args: { uid: string }; Returns: Json }
      wallow: { Args: never; Returns: Json }
      wasted_tickles_leaderboard: {
        Args: { limit_n?: number }
        Returns: {
          username: string
          wasted: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
