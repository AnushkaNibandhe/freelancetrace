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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bids: {
        Row: {
          amount: number
          created_at: string | null
          estimated_duration_days: number | null
          freelancer_id: string
          id: string
          milestone_breakdown: Json | null
          project_id: string
          proposal: string | null
          status: Database["public"]["Enums"]["bid_status"] | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          estimated_duration_days?: number | null
          freelancer_id: string
          id?: string
          milestone_breakdown?: Json | null
          project_id: string
          proposal?: string | null
          status?: Database["public"]["Enums"]["bid_status"] | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          estimated_duration_days?: number | null
          freelancer_id?: string
          id?: string
          milestone_breakdown?: Json | null
          project_id?: string
          proposal?: string | null
          status?: Database["public"]["Enums"]["bid_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bids_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      commits: {
        Row: {
          additions: number | null
          author: string | null
          commit_hash: string
          committed_at: string | null
          created_at: string | null
          deletions: number | null
          files_changed: string[] | null
          id: string
          message: string | null
          project_id: string
          repository_id: string
        }
        Insert: {
          additions?: number | null
          author?: string | null
          commit_hash: string
          committed_at?: string | null
          created_at?: string | null
          deletions?: number | null
          files_changed?: string[] | null
          id?: string
          message?: string | null
          project_id: string
          repository_id: string
        }
        Update: {
          additions?: number | null
          author?: string | null
          commit_hash?: string
          committed_at?: string | null
          created_at?: string | null
          deletions?: number | null
          files_changed?: string[] | null
          id?: string
          message?: string | null
          project_id?: string
          repository_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commits_repository_id_fkey"
            columns: ["repository_id"]
            isOneToOne: false
            referencedRelation: "github_repositories"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          actual_end_date: string | null
          bid_id: string
          client_id: string
          created_at: string | null
          expected_end_date: string | null
          freelancer_id: string
          id: string
          is_active: boolean | null
          project_id: string
          start_date: string | null
          terms: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          actual_end_date?: string | null
          bid_id: string
          client_id: string
          created_at?: string | null
          expected_end_date?: string | null
          freelancer_id: string
          id?: string
          is_active?: boolean | null
          project_id: string
          start_date?: string | null
          terms?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          actual_end_date?: string | null
          bid_id?: string
          client_id?: string
          created_at?: string | null
          expected_end_date?: string | null
          freelancer_id?: string
          id?: string
          is_active?: boolean | null
          project_id?: string
          start_date?: string | null
          terms?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          against: string
          created_at: string | null
          evidence: Json | null
          id: string
          milestone_id: string | null
          opened_by: string
          project_id: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["dispute_status"] | null
          updated_at: string | null
        }
        Insert: {
          against: string
          created_at?: string | null
          evidence?: Json | null
          id?: string
          milestone_id?: string | null
          opened_by: string
          project_id: string
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"] | null
          updated_at?: string | null
        }
        Update: {
          against?: string
          created_at?: string | null
          evidence?: Json | null
          id?: string
          milestone_id?: string | null
          opened_by?: string
          project_id?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disputes_against_fkey"
            columns: ["against"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          github_issue_url: string | null
          id: string
          is_addressed: boolean | null
          project_id: string
          requirement_id: string | null
          updated_at: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          github_issue_url?: string | null
          id?: string
          is_addressed?: boolean | null
          project_id: string
          requirement_id?: string | null
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          github_issue_url?: string | null
          id?: string
          is_addressed?: boolean | null
          project_id?: string
          requirement_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      github_repositories: {
        Row: {
          created_at: string | null
          id: string
          installation_id: string | null
          is_connected: boolean | null
          last_sync_at: string | null
          owner: string
          project_id: string
          repo_name: string
          repo_url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          installation_id?: string | null
          is_connected?: boolean | null
          last_sync_at?: string | null
          owner: string
          project_id: string
          repo_name: string
          repo_url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          installation_id?: string | null
          is_connected?: boolean | null
          last_sync_at?: string | null
          owner?: string
          project_id?: string
          repo_name?: string
          repo_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "github_repositories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_snapshots: {
        Row: {
          compliance_score: number | null
          created_at: string | null
          delay_risk_score: number | null
          drift_score: number | null
          fulfillment_score: number | null
          id: string
          milestone_id: string | null
          project_id: string
          requirements_fulfilled: number | null
          snapshot_at: string | null
          total_commits: number | null
          total_requirements: number | null
          trust_score: number | null
        }
        Insert: {
          compliance_score?: number | null
          created_at?: string | null
          delay_risk_score?: number | null
          drift_score?: number | null
          fulfillment_score?: number | null
          id?: string
          milestone_id?: string | null
          project_id: string
          requirements_fulfilled?: number | null
          snapshot_at?: string | null
          total_commits?: number | null
          total_requirements?: number | null
          trust_score?: number | null
        }
        Update: {
          compliance_score?: number | null
          created_at?: string | null
          delay_risk_score?: number | null
          drift_score?: number | null
          fulfillment_score?: number | null
          id?: string
          milestone_id?: string | null
          project_id?: string
          requirements_fulfilled?: number | null
          snapshot_at?: string | null
          total_commits?: number | null
          total_requirements?: number | null
          trust_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metric_snapshots_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          amount: number
          approved_at: string | null
          contract_id: string
          created_at: string | null
          current_fulfillment: number | null
          description: string | null
          drift_score: number | null
          due_date: string | null
          fulfillment_threshold: number | null
          id: string
          order_index: number | null
          project_id: string
          status: Database["public"]["Enums"]["milestone_status"] | null
          submitted_at: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          contract_id: string
          created_at?: string | null
          current_fulfillment?: number | null
          description?: string | null
          drift_score?: number | null
          due_date?: string | null
          fulfillment_threshold?: number | null
          id?: string
          order_index?: number | null
          project_id: string
          status?: Database["public"]["Enums"]["milestone_status"] | null
          submitted_at?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          contract_id?: string
          created_at?: string | null
          current_fulfillment?: number | null
          description?: string | null
          drift_score?: number | null
          due_date?: string | null
          fulfillment_threshold?: number | null
          id?: string
          order_index?: number | null
          project_id?: string
          status?: Database["public"]["Enums"]["milestone_status"] | null
          submitted_at?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestones_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          contract_id: string
          created_at: string | null
          id: string
          milestone_id: string
          net_amount: number
          paid_at: string | null
          payee_id: string
          payer_id: string
          payment_provider: string | null
          payout_at: string | null
          platform_fee: number | null
          provider_payment_id: string | null
          provider_payout_id: string | null
          status: Database["public"]["Enums"]["payment_status"] | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string | null
          id?: string
          milestone_id: string
          net_amount: number
          paid_at?: string | null
          payee_id: string
          payer_id: string
          payment_provider?: string | null
          payout_at?: string | null
          platform_fee?: number | null
          provider_payment_id?: string | null
          provider_payout_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string | null
          id?: string
          milestone_id?: string
          net_amount?: number
          paid_at?: string | null
          payee_id?: string
          payer_id?: string
          payment_provider?: string | null
          payout_at?: string | null
          platform_fee?: number | null
          provider_payment_id?: string | null
          provider_payout_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payee_id_fkey"
            columns: ["payee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          avg_approval_time: unknown
          bio: string | null
          created_at: string | null
          dispute_rate: number | null
          email: string
          full_name: string | null
          github_username: string | null
          hourly_rate: number | null
          id: string
          is_suspended: boolean | null
          is_verified: boolean | null
          organization_name: string | null
          portfolio_url: string | null
          projects_completed: number | null
          role: Database["public"]["Enums"]["user_role"]
          skills: string[] | null
          tech_stack: string[] | null
          total_earnings: number | null
          total_spent: number | null
          trust_score: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          avg_approval_time?: unknown
          bio?: string | null
          created_at?: string | null
          dispute_rate?: number | null
          email: string
          full_name?: string | null
          github_username?: string | null
          hourly_rate?: number | null
          id: string
          is_suspended?: boolean | null
          is_verified?: boolean | null
          organization_name?: string | null
          portfolio_url?: string | null
          projects_completed?: number | null
          role?: Database["public"]["Enums"]["user_role"]
          skills?: string[] | null
          tech_stack?: string[] | null
          total_earnings?: number | null
          total_spent?: number | null
          trust_score?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          avg_approval_time?: unknown
          bio?: string | null
          created_at?: string | null
          dispute_rate?: number | null
          email?: string
          full_name?: string | null
          github_username?: string | null
          hourly_rate?: number | null
          id?: string
          is_suspended?: boolean | null
          is_verified?: boolean | null
          organization_name?: string | null
          portfolio_url?: string | null
          projects_completed?: number | null
          role?: Database["public"]["Enums"]["user_role"]
          skills?: string[] | null
          tech_stack?: string[] | null
          total_earnings?: number | null
          total_spent?: number | null
          trust_score?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          awarded_at: string | null
          awarded_freelancer_id: string | null
          budget_max: number | null
          budget_min: number | null
          client_id: string
          completed_at: string | null
          created_at: string | null
          description: string | null
          domain: string | null
          duration_days: number | null
          id: string
          srs_file_url: string | null
          srs_parsed_at: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          tech_stack: string[] | null
          title: string
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          awarded_at?: string | null
          awarded_freelancer_id?: string | null
          budget_max?: number | null
          budget_min?: number | null
          client_id: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          domain?: string | null
          duration_days?: number | null
          id?: string
          srs_file_url?: string | null
          srs_parsed_at?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          tech_stack?: string[] | null
          title: string
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          awarded_at?: string | null
          awarded_freelancer_id?: string | null
          budget_max?: number | null
          budget_min?: number | null
          client_id?: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          domain?: string | null
          duration_days?: number | null
          id?: string
          srs_file_url?: string | null
          srs_parsed_at?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          tech_stack?: string[] | null
          title?: string
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_awarded_freelancer_id_fkey"
            columns: ["awarded_freelancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_commit_links: {
        Row: {
          commit_id: string
          created_at: string | null
          id: string
          requirement_id: string
          similarity_score: number | null
        }
        Insert: {
          commit_id: string
          created_at?: string | null
          id?: string
          requirement_id: string
          similarity_score?: number | null
        }
        Update: {
          commit_id?: string
          created_at?: string | null
          id?: string
          requirement_id?: string
          similarity_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "requirement_commit_links_commit_id_fkey"
            columns: ["commit_id"]
            isOneToOne: false
            referencedRelation: "commits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_commit_links_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      requirements: {
        Row: {
          coverage_percentage: number | null
          created_at: string | null
          embedding_vector: Json | null
          id: string
          last_commit_at: string | null
          order_index: number | null
          priority: string | null
          project_id: string
          requirement_text: string
          status: Database["public"]["Enums"]["requirement_status"] | null
          updated_at: string | null
        }
        Insert: {
          coverage_percentage?: number | null
          created_at?: string | null
          embedding_vector?: Json | null
          id?: string
          last_commit_at?: string | null
          order_index?: number | null
          priority?: string | null
          project_id: string
          requirement_text: string
          status?: Database["public"]["Enums"]["requirement_status"] | null
          updated_at?: string | null
        }
        Update: {
          coverage_percentage?: number | null
          created_at?: string | null
          embedding_vector?: Json | null
          id?: string
          last_commit_at?: string | null
          order_index?: number | null
          priority?: string | null
          project_id?: string
          requirement_text?: string
          status?: Database["public"]["Enums"]["requirement_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requirements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      bid_status: "pending" | "accepted" | "rejected" | "withdrawn"
      dispute_status: "open" | "under_review" | "resolved"
      milestone_status:
        | "pending"
        | "in_progress"
        | "submitted"
        | "approved"
        | "disputed"
      payment_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "refunded"
      project_status:
        | "draft"
        | "open"
        | "in_progress"
        | "completed"
        | "cancelled"
      requirement_status: "not_started" | "in_progress" | "fulfilled"
      user_role: "client" | "freelancer" | "admin"
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
  public: {
    Enums: {
      bid_status: ["pending", "accepted", "rejected", "withdrawn"],
      dispute_status: ["open", "under_review", "resolved"],
      milestone_status: [
        "pending",
        "in_progress",
        "submitted",
        "approved",
        "disputed",
      ],
      payment_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "refunded",
      ],
      project_status: [
        "draft",
        "open",
        "in_progress",
        "completed",
        "cancelled",
      ],
      requirement_status: ["not_started", "in_progress", "fulfilled"],
      user_role: ["client", "freelancer", "admin"],
    },
  },
} as const
