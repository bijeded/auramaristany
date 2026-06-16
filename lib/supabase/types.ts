export type UserRole = "client" | "admin";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "completed";
export type BillingModel = "fixed_term_monthly" | "rolling_monthly";
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          phone: string | null;
          birth_date: string | null;
          avatar_url: string | null;
          role: UserRole;
          stripe_customer_id: string | null;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          phone?: string | null;
          birth_date?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          stripe_customer_id?: string | null;
          onboarding_completed?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      onboarding_questions: {
        Row: {
          id: string;
          sort_order: number;
          question_text: string;
          question_type: string;
          options: Json | null;
          is_required: boolean;
          is_active: boolean;
        };
        Insert: {
          sort_order: number;
          question_text: string;
          question_type: string;
          options?: Json | null;
          is_required?: boolean;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["onboarding_questions"]["Insert"]>;
        Relationships: [];
      };
      onboarding_responses: {
        Row: {
          id: string;
          profile_id: string;
          responses: Json;
          completed_at: string | null;
        };
        Insert: {
          profile_id: string;
          responses: Json;
          completed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["onboarding_responses"]["Insert"]>;
        Relationships: [];
      };
      programs: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          billing_model: BillingModel;
          duration_months: number | null;
          is_active: boolean;
        };
        Insert: {
          slug: string;
          name: string;
          description?: string | null;
          billing_model: BillingModel;
          duration_months?: number | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["programs"]["Insert"]>;
        Relationships: [];
      };
      program_variants: {
        Row: {
          id: string;
          program_id: string | null;
          slug: string;
          name: string;
          level: string | null;
          time_availability: string | null;
          stripe_price_id: string;
          price_mxn: number;
          is_active: boolean;
        };
        Insert: {
          program_id?: string | null;
          slug: string;
          name: string;
          level?: string | null;
          time_availability?: string | null;
          stripe_price_id: string;
          price_mxn: number;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["program_variants"]["Insert"]>;
        Relationships: [];
      };
      program_variant_prerequisites: {
        Row: {
          id: string;
          program_variant_id: string | null;
          prerequisite_group: number;
          required_program_slug: string;
          required_variant_levels: string[] | null;
          required_status: string;
        };
        Insert: {
          program_variant_id?: string | null;
          prerequisite_group: number;
          required_program_slug: string;
          required_variant_levels?: string[] | null;
          required_status?: string;
        };
        Update: Partial<Database["public"]["Tables"]["program_variant_prerequisites"]["Insert"]>;
        Relationships: [];
      };
      program_series: {
        Row: {
          id: string;
          program_id: string | null;
          series_number: number;
          title: string;
          description: string | null;
          published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          program_id?: string | null;
          series_number: number;
          title: string;
          description?: string | null;
          published?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["program_series"]["Insert"]>;
        Relationships: [];
      };
      program_days: {
        Row: {
          id: string;
          series_id: string | null;
          week_number: number;
          day_of_week: string;
          workout_focus: string | null;
          title: string;
          description: string | null;
          day_type: string;
          duration_minutes: number | null;
          published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          series_id?: string | null;
          week_number: number;
          day_of_week: string;
          workout_focus?: string | null;
          title: string;
          description?: string | null;
          day_type?: string;
          duration_minutes?: number | null;
          published?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["program_days"]["Insert"]>;
        Relationships: [];
      };
      program_day_blocks: {
        Row: {
          id: string;
          day_id: string | null;
          block_type: string;
          sort_order: number;
          content: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          day_id?: string | null;
          block_type: string;
          sort_order: number;
          content: Json;
        };
        Update: Partial<Database["public"]["Tables"]["program_day_blocks"]["Insert"]>;
        Relationships: [];
      };
      program_series_pillars: {
        Row: {
          id: string;
          series_id: string;
          pillar_key: string;
          title: string;
          sort_order: number;
          published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          series_id: string;
          pillar_key: string;
          title: string;
          sort_order?: number;
          published?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["program_series_pillars"]["Insert"]>;
        Relationships: [];
      };
      program_pillar_blocks: {
        Row: {
          id: string;
          pillar_id: string;
          block_type: string;
          sort_order: number;
          content: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          pillar_id: string;
          block_type: string;
          sort_order: number;
          content: Json;
        };
        Update: Partial<Database["public"]["Tables"]["program_pillar_blocks"]["Insert"]>;
        Relationships: [];
      };
      variant_series_map: {
        Row: {
          program_variant_id: string;
          series_id: string;
        };
        Insert: {
          program_variant_id: string;
          series_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["variant_series_map"]["Insert"]>;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          profile_id: string | null;
          program_variant_id: string | null;
          stripe_subscription_id: string;
          stripe_customer_id: string;
          status: SubscriptionStatus;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          months_elapsed: number;
          enrollment_date: string;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          profile_id?: string | null;
          program_variant_id?: string | null;
          stripe_subscription_id: string;
          stripe_customer_id: string;
          status: SubscriptionStatus;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          months_elapsed?: number;
          enrollment_date?: string;
          completed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
        Relationships: [];
      };
      subscription_events: {
        Row: {
          id: string;
          subscription_id: string | null;
          stripe_event_id: string;
          event_type: string;
          payload: Json;
          processed_at: string;
        };
        Insert: {
          subscription_id?: string | null;
          stripe_event_id: string;
          event_type: string;
          payload: Json;
          processed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscription_events"]["Insert"]>;
        Relationships: [];
      };
      progress_logs: {
        Row: {
          id: string;
          profile_id: string | null;
          subscription_id: string | null;
          program_day_id: string | null;
          log_date: string;
          completed: boolean;
          exercises_done: Json;
          /** DB column name is "notes". Use alias "general_notes:notes" in select when needed. */
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          profile_id?: string | null;
          subscription_id?: string | null;
          program_day_id?: string | null;
          log_date?: string;
          completed?: boolean;
          exercises_done?: Json;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["progress_logs"]["Insert"]>;
        Relationships: [];
      };
      body_metrics: {
        Row: {
          id: string;
          profile_id: string | null;
          metric_date: string;
          weight_kg: number | null;
          waist_cm: number | null;
          hip_cm: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          profile_id?: string | null;
          metric_date: string;
          weight_kg?: number | null;
          waist_cm?: number | null;
          hip_cm?: number | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["body_metrics"]["Insert"]>;
        Relationships: [];
      };
      progress_photos: {
        Row: {
          id: string;
          profile_id: string | null;
          body_metrics_id: string | null;
          storage_path: string;
          taken_at: string;
          /** Added in migration 005. */
          caption: string | null;
          created_at: string;
        };
        Insert: {
          profile_id?: string | null;
          body_metrics_id?: string | null;
          storage_path: string;
          taken_at?: string;
          caption?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["progress_photos"]["Insert"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          sender_id: string | null;
          subject: string;
          body: string;
          is_broadcast: boolean;
          created_at: string;
        };
        Insert: {
          sender_id?: string | null;
          subject: string;
          body: string;
          is_broadcast?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [];
      };
      message_recipients: {
        Row: {
          id: string;
          message_id: string | null;
          recipient_id: string | null;
          read_at: string | null;
        };
        Insert: {
          message_id?: string | null;
          recipient_id?: string | null;
          read_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["message_recipients"]["Insert"]>;
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          subscription_id: string | null;
          stripe_invoice_id: string;
          amount_paid: number;
          currency: string;
          status: string;
          invoice_date: string;
          created_at: string;
        };
        Insert: {
          subscription_id?: string | null;
          stripe_invoice_id: string;
          amount_paid: number;
          currency?: string;
          status: string;
          invoice_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
