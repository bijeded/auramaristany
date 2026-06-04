export type UserRole = "client" | "admin";
export type SubscriptionStatus = "active" | "past_due" | "canceled" | "unpaid" | "completed";
export type BillingModel = "fixed_term_monthly" | "ongoing_monthly";
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: {
      programs: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          billing_model: BillingModel;
          duration_months: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
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
      };
      program_variants: {
        Row: {
          id: string;
          program_id: string;
          slug: string;
          name: string;
          level: string | null;
          price_mxn: number;
          stripe_price_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          program_id: string;
          slug: string;
          name: string;
          level?: string | null;
          price_mxn: number;
          stripe_price_id?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["program_variants"]["Insert"]>;
      };
      program_variant_prerequisites: {
        Row: {
          id: string;
          program_variant_id: string;
          prerequisite_group: number;
          required_program_slug: string;
          required_variant_levels: string[] | null;
          required_status: string;
          created_at: string;
        };
        Insert: {
          program_variant_id: string;
          prerequisite_group: number;
          required_program_slug: string;
          required_variant_levels?: string[] | null;
          required_status: string;
        };
        Update: Partial<Database["public"]["Tables"]["program_variant_prerequisites"]["Insert"]>;
      };
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
      };
      subscriptions: {
        Row: {
          id: string;
          profile_id: string;
          program_variant_id: string;
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
          profile_id: string;
          program_variant_id: string;
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
      };
      onboarding_questions: {
        Row: {
          id: string;
          question_text: string;
          question_type: string;
          options: Json | null;
          is_required: boolean;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          question_text: string;
          question_type: string;
          options?: Json | null;
          is_required?: boolean;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["onboarding_questions"]["Insert"]>;
      };
      onboarding_responses: {
        Row: {
          id: string;
          profile_id: string;
          responses: Json;
          completed_at: string;
          created_at: string;
        };
        Insert: {
          profile_id: string;
          responses: Json;
          completed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["onboarding_responses"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
