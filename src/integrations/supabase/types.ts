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
      acuerdos: {
        Row: {
          company_id: string | null
          contacto: string
          created_at: string
          duracion_meses: number
          estado: string
          familia_producto: string[]
          fecha_fin: string | null
          fecha_inicio: string | null
          id: string
          influencer: string
          moneda: string
          notas: string
          plataforma: string
          red_social: string[]
          reels_pactados: number
          seguidores: number
          stories_pactadas: number
          tipo_contenido: string[]
          user_id: string
          valor_mensual: number
          valor_total: number
        }
        Insert: {
          company_id?: string | null
          contacto?: string
          created_at?: string
          duracion_meses?: number
          estado?: string
          familia_producto?: string[]
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          influencer?: string
          moneda?: string
          notas?: string
          plataforma?: string
          red_social?: string[]
          reels_pactados?: number
          seguidores?: number
          stories_pactadas?: number
          tipo_contenido?: string[]
          user_id: string
          valor_mensual?: number
          valor_total?: number
        }
        Update: {
          company_id?: string | null
          contacto?: string
          created_at?: string
          duracion_meses?: number
          estado?: string
          familia_producto?: string[]
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          influencer?: string
          moneda?: string
          notas?: string
          plataforma?: string
          red_social?: string[]
          reels_pactados?: number
          seguidores?: number
          stories_pactadas?: number
          tipo_contenido?: string[]
          user_id?: string
          valor_mensual?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "acuerdos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          module: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          module?: string
          user_id?: string | null
          user_name?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          module?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      entregables: {
        Row: {
          acuerdo_id: string | null
          company_id: string | null
          created_at: string
          descripcion: string
          estado: string
          fecha_entrega: string | null
          fecha_programada: string | null
          id: string
          influencer: string
          notas: string
          tipo_contenido: string
          url_contenido: string
          user_id: string
        }
        Insert: {
          acuerdo_id?: string | null
          company_id?: string | null
          created_at?: string
          descripcion?: string
          estado?: string
          fecha_entrega?: string | null
          fecha_programada?: string | null
          id?: string
          influencer?: string
          notas?: string
          tipo_contenido?: string
          url_contenido?: string
          user_id: string
        }
        Update: {
          acuerdo_id?: string | null
          company_id?: string | null
          created_at?: string
          descripcion?: string
          estado?: string
          fecha_entrega?: string | null
          fecha_programada?: string | null
          id?: string
          influencer?: string
          notas?: string
          tipo_contenido?: string
          url_contenido?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entregables_acuerdo_id_fkey"
            columns: ["acuerdo_id"]
            isOneToOne: false
            referencedRelation: "acuerdos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      kpis: {
        Row: {
          acuerdo_id: string | null
          alcance: number
          clicks: number
          company_id: string | null
          cpc: number
          cpr: number
          created_at: string
          engagement: number
          entregable_id: string | null
          estado: string
          id: string
          impresiones: number
          influencer: string
          interacciones: number
          notas: string
          periodo: string
          user_id: string
          valor_mensual_snapshot: number
        }
        Insert: {
          acuerdo_id?: string | null
          alcance?: number
          clicks?: number
          company_id?: string | null
          cpc?: number
          cpr?: number
          created_at?: string
          engagement?: number
          entregable_id?: string | null
          estado?: string
          id?: string
          impresiones?: number
          influencer?: string
          interacciones?: number
          notas?: string
          periodo?: string
          user_id: string
          valor_mensual_snapshot?: number
        }
        Update: {
          acuerdo_id?: string | null
          alcance?: number
          clicks?: number
          company_id?: string | null
          cpc?: number
          cpr?: number
          created_at?: string
          engagement?: number
          entregable_id?: string | null
          estado?: string
          id?: string
          impresiones?: number
          influencer?: string
          interacciones?: number
          notas?: string
          periodo?: string
          user_id?: string
          valor_mensual_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpis_acuerdo_id_fkey"
            columns: ["acuerdo_id"]
            isOneToOne: false
            referencedRelation: "acuerdos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_entregable_id_fkey"
            columns: ["entregable_id"]
            isOneToOne: false
            referencedRelation: "entregables"
            referencedColumns: ["id"]
          },
        ]
      }
      module_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      pagos: {
        Row: {
          acuerdo_id: string | null
          company_id: string | null
          comprobante: string
          concepto: string
          created_at: string
          estado: string
          fecha_pago: string | null
          id: string
          influencer: string
          metodo_pago: string
          moneda: string
          monto: number
          notas: string
          user_id: string
        }
        Insert: {
          acuerdo_id?: string | null
          company_id?: string | null
          comprobante?: string
          concepto?: string
          created_at?: string
          estado?: string
          fecha_pago?: string | null
          id?: string
          influencer?: string
          metodo_pago?: string
          moneda?: string
          monto?: number
          notas?: string
          user_id: string
        }
        Update: {
          acuerdo_id?: string | null
          company_id?: string | null
          comprobante?: string
          concepto?: string
          created_at?: string
          estado?: string
          fecha_pago?: string | null
          id?: string
          influencer?: string
          metodo_pago?: string
          moneda?: string
          monto?: number
          notas?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_acuerdo_id_fkey"
            columns: ["acuerdo_id"]
            isOneToOne: false
            referencedRelation: "acuerdos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string
          first_name: string
          full_name: string
          id: string
          is_active: boolean
          last_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string
          first_name?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string
          first_name?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_protected_user: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "gerencia"
        | "coordinador_mercadeo"
        | "admin_contabilidad"
        | "super_admin"
        | "analista"
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
      app_role: [
        "gerencia",
        "coordinador_mercadeo",
        "admin_contabilidad",
        "super_admin",
        "analista",
      ],
    },
  },
} as const
