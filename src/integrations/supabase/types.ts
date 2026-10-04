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
      admin_permissions: {
        Row: {
          can_view_contacts: boolean
          is_owner: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          can_view_contacts?: boolean
          is_owner?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          can_view_contacts?: boolean
          is_owner?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      announcement_signups: {
        Row: {
          announcement_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_signups_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string
          event_date: string | null
          id: string
          image_url: string | null
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          event_date?: string | null
          id?: string
          image_url?: string | null
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          event_date?: string | null
          id?: string
          image_url?: string | null
          published?: boolean
          title?: string
          updated_at?: string
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
      contact_access_log: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          member_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          member_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          member_id?: string
        }
        Relationships: []
      }
      daily_readings: {
        Row: {
          book_name: string
          book_nr: number
          chapter: number
          created_at: string
          created_by: string
          id: string
          points: number
          reading_date: string
        }
        Insert: {
          book_name: string
          book_nr: number
          chapter: number
          created_at?: string
          created_by?: string
          id?: string
          points?: number
          reading_date: string
        }
        Update: {
          book_name?: string
          book_nr?: number
          chapter?: number
          created_at?: string
          created_by?: string
          id?: string
          points?: number
          reading_date?: string
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
      member_notifications: {
        Row: {
          announcement_id: string | null
          created_at: string
          id: string
          kind: string
          message: string
          quiz_id: string | null
          read: boolean
          ref_id: string | null
          user_id: string
        }
        Insert: {
          announcement_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message: string
          quiz_id?: string | null
          read?: boolean
          ref_id?: string | null
          user_id: string
        }
        Update: {
          announcement_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string
          quiz_id?: string | null
          read?: boolean
          ref_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_notifications_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_notifications_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          kind: string
          message: string
          read: boolean
          ref_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind: string
          message: string
          read?: boolean
          ref_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string
          read?: boolean
          ref_id?: string | null
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
          account_type: string
          address: string | null
          avatar: string
          birth_date: string | null
          class_name: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          photo_url: string | null
          status: string
        }
        Insert: {
          academic_year?: string | null
          account_type?: string
          address?: string | null
          avatar?: string
          birth_date?: string | null
          class_name?: string | null
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          photo_url?: string | null
          status?: string
        }
        Update: {
          academic_year?: string | null
          account_type?: string
          address?: string | null
          avatar?: string
          birth_date?: string | null
          class_name?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          status?: string
        }
        Relationships: []
      }
      quiz_answers: {
        Row: {
          choice: number
          correct: boolean
          created_at: string
          id: string
          question_id: string
          quiz_id: string
          user_id: string
        }
        Insert: {
          choice: number
          correct: boolean
          created_at?: string
          id?: string
          question_id: string
          quiz_id: string
          user_id: string
        }
        Update: {
          choice?: number
          correct?: boolean
          created_at?: string
          id?: string
          question_id?: string
          quiz_id?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          created_at: string
          id: string
          max_score: number
          quiz_id: string
          score: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_score: number
          quiz_id: string
          score: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          max_score?: number
          quiz_id?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct: number
          id: string
          image_url: string | null
          options: string[]
          points: number
          question: string
          quiz_id: string
          sort: number
        }
        Insert: {
          correct: number
          id?: string
          image_url?: string | null
          options: string[]
          points?: number
          question: string
          quiz_id: string
          sort?: number
        }
        Update: {
          correct?: number
          id?: string
          image_url?: string | null
          options?: string[]
          points?: number
          question?: string
          quiz_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          closes_at: string | null
          created_at: string
          created_by: string
          id: string
          image_url: string | null
          opens_at: string | null
          published: boolean
          title: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          image_url?: string | null
          opens_at?: string | null
          published?: boolean
          title: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          image_url?: string | null
          opens_at?: string | null
          published?: boolean
          title?: string
        }
        Relationships: []
      }
      reading_completions: {
        Row: {
          created_at: string
          id: string
          reading_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reading_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reading_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_completions_reading_id_fkey"
            columns: ["reading_id"]
            isOneToOne: false
            referencedRelation: "daily_readings"
            referencedColumns: ["id"]
          },
        ]
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
      servant_attendance: {
        Row: {
          created_at: string
          id: string
          servant_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          servant_id?: string
          week_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          servant_id?: string
          week_start?: string
        }
        Relationships: []
      }
      servant_preparations: {
        Row: {
          created_at: string
          id: string
          images: string[]
          notes: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          images?: string[]
          notes?: string
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          images?: string[]
          notes?: string
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          body: string
          created_at: string
          id: string
          images: string[]
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          images?: string[]
          user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          images?: string[]
          user_id?: string
        }
        Relationships: []
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
      visitations: {
        Row: {
          created_at: string
          id: string
          member_id: string
          method: string
          note: string
          servant_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          method?: string
          note?: string
          servant_id?: string
          week_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          method?: string
          note?: string
          servant_id?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_absence: {
        Args: { _offset?: number }
        Returns: {
          academic_year: string
          full_name: string
          id: string
          visited: boolean
        }[]
      }
      admin_absence_by_type: {
        Args: { _offset?: number; _type?: string }
        Returns: {
          academic_year: string
          full_name: string
          id: string
          visited: boolean
        }[]
      }
      admin_members: {
        Args: never
        Returns: {
          academic_year: string
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
      admin_notify_absent: { Args: { _year: string }; Returns: number }
      admin_prep_status: {
        Args: { _offset?: number }
        Returns: {
          full_name: string
          images: string[]
          notes: string
          submitted: boolean
          submitted_at: string
          user_id: string
          visits: number
        }[]
      }
      admin_quiz_results: {
        Args: { _quiz: string }
        Returns: {
          academic_year: string
          created_at: string
          full_name: string
          max_score: number
          score: number
        }[]
      }
      admin_remove_member: { Args: { _member: string }; Returns: undefined }
      admin_review_log: {
        Args: {
          _log_id: string
          _points: number
          _reason: string
          _status: string
        }
        Returns: undefined
      }
      admin_servant_attendance: {
        Args: { _offset?: number }
        Returns: {
          attended: boolean
          attended_at: string
          full_name: string
          user_id: string
        }[]
      }
      admin_set_account_type: {
        Args: { _member: string; _type: string }
        Returns: undefined
      }
      admin_set_redemption: {
        Args: { _id: string; _note: string; _status: string }
        Returns: undefined
      }
      admin_signups: {
        Args: { _ann: string }
        Returns: {
          academic_year: string
          created_at: string
          full_name: string
          user_id: string
        }[]
      }
      admin_visit_report: {
        Args: { _offset?: number }
        Returns: {
          academic_year: string
          created_at: string
          member: string
          method: string
          note: string
          servant: string
        }[]
      }
      answer_question: {
        Args: { _choice: number; _question: string }
        Returns: Json
      }
      balance_of: { Args: { _uid: string }; Returns: number }
      birthdays: {
        Args: { _month: number }
        Returns: {
          academic_year: string
          avatar: string
          day: number
          full_name: string
          id: string
          photo_url: string
        }[]
      }
      can_view_contacts: { Args: { _uid: string }; Returns: boolean }
      complete_reading: { Args: { _reading: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _uid: string }; Returns: boolean }
      is_current_week: {
        Args: { _m: number; _w: number; _y: number }
        Returns: boolean
      }
      is_owner: { Args: { _uid: string }; Returns: boolean }
      is_servant: { Args: { _uid: string }; Returns: boolean }
      leaderboard: {
        Args: never
        Returns: {
          avatar: string
          full_name: string
          id: string
          points: number
        }[]
      }
      leaderboard_years: {
        Args: never
        Returns: {
          academic_year: string
          avatar: string
          full_name: string
          id: string
          photo_url: string
          points: number
        }[]
      }
      mark_servant_attendance: { Args: never; Returns: string }
      member_visit_history: {
        Args: { _member: string }
        Returns: {
          created_at: string
          method: string
          note: string
          servant: string
          week_start: string
        }[]
      }
      my_contact: {
        Args: never
        Returns: {
          address: string
          birth_date: string
          phone: string
        }[]
      }
      my_deductions: {
        Args: never
        Returns: {
          amount: number
          created_at: string
          reason: string
        }[]
      }
      my_permissions: { Args: never; Returns: Json }
      my_stats: { Args: never; Returns: Json }
      notify_missing_preparations: {
        Args: { _offset?: number }
        Returns: number
      }
      owner_list_staff: {
        Args: never
        Returns: {
          avatar: string
          can_view_contacts: boolean
          full_name: string
          is_admin: boolean
          is_owner: boolean
          user_id: string
        }[]
      }
      owner_set_staff: {
        Args: { _can_view: boolean; _is_admin: boolean; _user: string }
        Returns: undefined
      }
      points_of: { Args: { _uid: string }; Returns: number }
      promote_academic_years: { Args: never; Returns: undefined }
      quiz_league: {
        Args: never
        Returns: {
          academic_year: string
          avatar: string
          full_name: string
          id: string
          photo_url: string
          points: number
          quizzes: number
        }[]
      }
      quiz_open: { Args: { _quiz: string }; Returns: boolean }
      quiz_questions_for: {
        Args: { _quiz: string }
        Returns: {
          id: string
          options: string[]
          points: number
          question: string
        }[]
      }
      quiz_questions_v2: {
        Args: { _quiz: string }
        Returns: {
          correct: number
          id: string
          image_url: string
          is_correct: boolean
          my_choice: number
          options: string[]
          points: number
          question: string
        }[]
      }
      redeem_gift: { Args: { _gift_id: string }; Returns: undefined }
      servant_members: {
        Args: never
        Returns: {
          academic_year: string
          active_this_week: boolean
          avatar: string
          full_name: string
          id: string
          photo_url: string
          visited: boolean
        }[]
      }
      signup_counts: {
        Args: never
        Returns: {
          announcement_id: string
          n: number
        }[]
      }
      staff_add_member: {
        Args: {
          _address: string
          _birth: string
          _name: string
          _phone: string
          _year: string
        }
        Returns: string
      }
      submit_quiz: { Args: { _answers: Json; _quiz: string }; Returns: Json }
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
      update_my_photo: { Args: { _photo: string }; Returns: undefined }
      update_my_profile: {
        Args: { _avatar: string; _class: string; _name: string }
        Returns: undefined
      }
      view_contact: {
        Args: { _member: string }
        Returns: {
          address: string
          birth_date: string
          phone: string
        }[]
      }
      visit_archive: {
        Args: never
        Returns: {
          academic_year: string
          created_at: string
          id: string
          member: string
          member_id: string
          method: string
          note: string
          servant: string
        }[]
      }
      week_start: { Args: { _offset?: number }; Returns: string }
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
