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
      acuerdos: {
        Row: {
          contacto: string
          created_at: string
          duracion_meses: number
          estado: string
          familia_producto: string
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
          contacto?: string
          created_at?: string
          duracion_meses?: number
          estado?: string
          familia_producto?: string
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
          contacto?: string
          created_at?: string
          duracion_meses?: number
          estado?: string
          familia_producto?: string
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
        Relationships: []
      }
      entregables: {
        Row: {
          acuerdo_id: string | null
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
        ]
      }
      kpis: {
        Row: {
          acuerdo_id: string | null
          alcance: number
          clicks: number
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
        }
        Insert: {
          acuerdo_id?: string | null
          alcance?: number
          clicks?: number
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
        }
        Update: {
          acuerdo_id?: string | null
          alcance?: number
          clicks?: number
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
            foreignKeyName: "kpis_entregable_id_fkey"
            columns: ["entregable_id"]
            isOneToOne: false
            referencedRelation: "entregables"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos: {
        Row: {
          acuerdo_id: string | null
          comprobante: string
          concepto: string
          created_at: string
          estado: string
          fecha_pago: string | null
          fecha_vencimiento: string | null
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
          comprobante?: string
          concepto?: string
          created_at?: string
          estado?: string
          fecha_pago?: string | null
          fecha_vencimiento?: string | null
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
          comprobante?: string
          concepto?: string
          created_at?: string
          estado?: string
          fecha_pago?: string | null
          fecha_vencimiento?: string | null
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
  public: {
    Enums: {},
  },
} as const
