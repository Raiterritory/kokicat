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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      friendships: {
        Row: {
          accepted: boolean
          addressee: string
          created_at: string
          requester: string
        }
        Insert: {
          accepted?: boolean
          addressee: string
          created_at?: string
          requester: string
        }
        Update: {
          accepted?: boolean
          addressee?: string
          created_at?: string
          requester?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_fkey"
            columns: ["addressee"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_fkey"
            columns: ["requester"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          best_hard: number
          best_normal: number
          created_at: string
          id: string
          is_admin: boolean
          login_fails: number
          login_locked_until: string | null
          nickname: string
          password_hash: string | null
          recovery_code: string | null
          save_data: Json | null
          secret: string
          skin: string
          updated_at: string
        }
        Insert: {
          best_hard?: number
          best_normal?: number
          created_at?: string
          id?: string
          is_admin?: boolean
          login_fails?: number
          login_locked_until?: string | null
          nickname: string
          password_hash?: string | null
          recovery_code?: string | null
          save_data?: Json | null
          secret?: string
          skin?: string
          updated_at?: string
        }
        Update: {
          best_hard?: number
          best_normal?: number
          created_at?: string
          id?: string
          is_admin?: boolean
          login_fails?: number
          login_locked_until?: string | null
          nickname?: string
          password_hash?: string | null
          recovery_code?: string | null
          save_data?: Json | null
          secret?: string
          skin?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          player_id: string
          token: string
          updated_at: string
        }
        Insert: {
          player_id: string
          token: string
          updated_at?: string
        }
        Update: {
          player_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _auth_admin: {
        Args: { p_id: string; p_secret: string }
        Returns: undefined
      }
      _auth_player: {
        Args: { p_id: string; p_secret: string }
        Returns: undefined
      }
      admin_check: {
        Args: { p_id: string; p_secret: string }
        Returns: boolean
      }
      admin_delete_player: {
        Args: { p_id: string; p_secret: string; p_target: string }
        Returns: undefined
      }
      admin_find_players: {
        Args: { p_id: string; p_query: string; p_secret: string }
        Returns: {
          best_hard: number
          best_normal: number
          created_at: string
          has_code: boolean
          has_password: boolean
          id: string
          is_admin: boolean
          nickname: string
        }[]
      }
      admin_recovery_code: {
        Args: { p_id: string; p_secret: string; p_target: string }
        Returns: string
      }
      admin_set_password: {
        Args: {
          p_id: string
          p_password: string
          p_secret: string
          p_target: string
        }
        Returns: undefined
      }
      delete_player: {
        Args: { p_id: string; p_secret: string }
        Returns: undefined
      }
      friends_leaderboard: {
        Args: { p_id: string; p_mode: string; p_secret: string }
        Returns: {
          id: string
          nickname: string
          score: number
          skin: string
        }[]
      }
      get_recovery_code: {
        Args: { p_id: string; p_secret: string }
        Returns: string
      }
      global_leaderboard: {
        Args: { p_limit?: number; p_mode: string }
        Returns: {
          id: string
          nickname: string
          score: number
          skin: string
        }[]
      }
      has_password: {
        Args: { p_id: string; p_secret: string }
        Returns: boolean
      }
      login_player: {
        Args: { p_nick: string; p_password: string }
        Returns: {
          id: string
          nickname: string
          save_data: Json
          secret: string
        }[]
      }
      my_friends: {
        Args: { p_id: string; p_secret: string }
        Returns: {
          id: string
          nickname: string
          status: string
        }[]
      }
      recover_player: {
        Args: { p_code: string; p_nick: string }
        Returns: {
          id: string
          nickname: string
          save_data: Json
          secret: string
        }[]
      }
      register_player: {
        Args: { p_nick: string }
        Returns: {
          id: string
          nickname: string
          secret: string
        }[]
      }
      remove_friend: {
        Args: { p_id: string; p_other: string; p_secret: string }
        Returns: undefined
      }
      respond_friend_request: {
        Args: {
          p_accept: boolean
          p_from: string
          p_id: string
          p_secret: string
        }
        Returns: undefined
      }
      save_profile: {
        Args: { p_data: Json; p_id: string; p_secret: string }
        Returns: undefined
      }
      save_push_token: {
        Args: { p_id: string; p_secret: string; p_token: string }
        Returns: undefined
      }
      search_players: {
        Args: { p_id: string; p_query: string; p_secret: string }
        Returns: {
          id: string
          nickname: string
        }[]
      }
      send_friend_request: {
        Args: { p_id: string; p_secret: string; p_to: string }
        Returns: undefined
      }
      set_password: {
        Args: { p_id: string; p_password: string; p_secret: string }
        Returns: undefined
      }
      set_score: {
        Args: {
          p_hard: number
          p_id: string
          p_normal: number
          p_secret: string
        }
        Returns: undefined
      }
      set_skin: {
        Args: { p_id: string; p_secret: string; p_skin: string }
        Returns: undefined
      }
      submit_score: {
        Args: {
          p_hard: number
          p_id: string
          p_normal: number
          p_secret: string
        }
        Returns: undefined
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
    Enums: {},
  },
} as const
