export type UserRole = "client" | "admin";
export type SubscriptionStatus = "active" | "past_due" | "canceled" | "unpaid";

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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
