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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          activity: string
          admin_note: string | null
          created_at: string
          id: string
          month: number
          points: number
          status: string
          user_id: string
          verse: string | null
          week: number
          year: number
        }
        Insert: {
          activity: string
          admin_note?: string | null
          created_at?: string
          id?: string
          month: number
          points?: number
          status?: string
          user_id: string
          verse?: string | null
          week: number
          year: number
        }
        Update: {
          activity?: string
          admin_note?: string | null
          created_at?: string
          id?: string
          month?: number
          points?: number
          status?: string
          user_id?: string
          verse?: string | null
          week?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_activity_fkey"
            columns: ["activity"]
            isOneToOne: false
            referencedRelation: "activity_settings"
            referencedColumns: ["key"]
          },
        ]
      }
      activity_settings: {
        Row: {
          emoji: string
          key: string
          label: string
          points: number
          sort: number
        }
        Insert: {
          emoji: string
          key: string
          label: string
          points?: number
          sort?: number
        }
        Update: {
          emoji?: string
          key?: string
          label?: string
          points?: number
          sort?: number
        }
        Relationships: []
      }
      badges: {
        Row: {
          created_at: string
          description: string | null
          emoji: string
          id: string
          name: string
          threshold: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          name: string
          threshold?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          name?: string
          threshold?: number
        }
        Relationships: []
      }
      gifts: {
        Row: {
          active: boolean
          cost: number
          created_at: string
          description: string | null
          emoji: string
          id: string
          name: string
          stock: number
        }
        Insert: {
          active?: boolean
          cost?: number
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          name: string
          stock?: number
        }
        Update: {
          active?: boolean
          cost?: number
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          name?: string
          stock?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          kind: string
          message: string
          read: boolean
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind: string
          message: string
          read?: boolean
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string
          read?: boolean
        }
        Relationships: []
      }
      point_adjustments: {
        Row: {
          admin_id: string | null
          amount: number
          created_at: string
          id: string
          log_id: string | null
          reason: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          amount: number
          created_at?: string
          id?: string
          log_id?: string | null
          reason: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          log_id?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          academic_year: string | null
          address: string | null
          avatar: string
          birth_date: string | null
          class_name: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          status: string
        }
        Insert: {
          academic_year?: string | null
          address?: string | null
          avatar?: string
          birth_date?: string | null
          class_name?: string | null
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          status?: string
        }
        Update: {
          academic_year?: string | null
          address?: string | null
          avatar?: string
          birth_date?: string | null
          class_name?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          status?: string
        }
        Relationships: []
      }
      redemptions: {
        Row: {
          admin_note: string | null
          cost: number
          created_at: string
          gift_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          cost: number
          created_at?: string
          gift_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          cost?: number
          created_at?: string
          gift_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redemptions_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "gifts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_members: {
        Args: never
        Returns: {
          avatar: string
          balance: number
          class_name: string
          created_at: string
          full_name: string
          id: string
          points: number
          status: string
        }[]
      }
      admin_review_log: {
        Args: {
          _log_id: string
          _points: number
          _reason: string
          _status: string
        }
        Returns: undefined
      }
      admin_set_redemption: {
        Args: { _id: string; _note: string; _status: string }
        Returns: undefined
      }
      balance_of: { Args: { _uid: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _uid: string }; Returns: boolean }
      leaderboard: {
        Args: never
        Returns: {
          avatar: string
          full_name: string
          id: string
          points: number
        }[]
      }
      my_stats: { Args: never; Returns: Json }
      points_of: { Args: { _uid: string }; Returns: number }
      redeem_gift: { Args: { _gift_id: string }; Returns: undefined }
      update_my_contact: {
        Args: {
          _academic_year: string
          _address: string
          _birth_date: string
          _name: string
          _phone: string
        }
        Returns: undefined
      }
      update_my_profile: {
        Args: { _avatar: string; _class: string; _name: string }
        Returns: undefined
      }
      weekly_leaderboard: {
        Args: { _offset?: number }
        Returns: {
          activities: number
          avatar: string
          full_name: string
          id: string
          points: number
          rank: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
