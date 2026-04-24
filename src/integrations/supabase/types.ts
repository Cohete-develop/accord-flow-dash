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
      ad_platform_connections: {
        Row: {
          account_id: string
          account_name: string
          company_id: string
          connected_by: string | null
          created_at: string
          credentials_vault_id: string | null
          id: string
          last_sync_at: string | null
          platform: string
          status: string
          sync_interval_minutes: number
          updated_at: string
        }
        Insert: {
          account_id: string
          account_name?: string
          company_id: string
          connected_by?: string | null
          created_at?: string
          credentials_vault_id?: string | null
          id?: string
          last_sync_at?: string | null
          platform: string
          status?: string
          sync_interval_minutes?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          account_name?: string
          company_id?: string
          connected_by?: string | null
          created_at?: string
          credentials_vault_id?: string | null
          id?: string
          last_sync_at?: string | null
          platform?: string
          status?: string
          sync_interval_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_platform_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_history: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_id: string
          campaign_sync_id: string | null
          company_id: string
          id: string
          message: string
          metric_value: number
          threshold_value: number
          triggered_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_id: string
          campaign_sync_id?: string | null
          company_id: string
          id?: string
          message: string
          metric_value: number
          threshold_value: number
          triggered_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_id?: string
          campaign_sync_id?: string | null
          company_id?: string
          id?: string
          message?: string
          metric_value?: number
          threshold_value?: number
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_history_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "campaign_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_history_campaign_sync_id_fkey"
            columns: ["campaign_sync_id"]
            isOneToOne: false
            referencedRelation: "campaigns_sync"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_history_company_id_fkey"
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
          company_id: string | null
          created_at: string
          details: Json | null
          id: string
          module: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          module?: string
          user_id?: string | null
          user_name?: string
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          module?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_domains: {
        Row: {
          created_at: string
          domain: string
        }
        Insert: {
          created_at?: string
          domain: string
        }
        Update: {
          created_at?: string
          domain?: string
        }
        Relationships: []
      }
      campaign_alerts: {
        Row: {
          campaign_sync_id: string | null
          company_id: string
          condition: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          last_triggered_at: string | null
          metric: string
          notify_channels: Json
          threshold: number
          window_minutes: number
        }
        Insert: {
          campaign_sync_id?: string | null
          company_id: string
          condition: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          metric: string
          notify_channels?: Json
          threshold: number
          window_minutes?: number
        }
        Update: {
          campaign_sync_id?: string | null
          company_id?: string
          condition?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          metric?: string
          notify_channels?: Json
          threshold?: number
          window_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_alerts_campaign_sync_id_fkey"
            columns: ["campaign_sync_id"]
            isOneToOne: false
            referencedRelation: "campaigns_sync"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_keywords: {
        Row: {
          campaign_sync_id: string
          clicks: number
          company_id: string
          conversions: number
          cost: number
          cpc: number
          created_at: string
          ctr: number
          date: string
          id: string
          impressions: number
          keyword: string
          match_type: string
          quality_score: number | null
          status: string
        }
        Insert: {
          campaign_sync_id: string
          clicks?: number
          company_id: string
          conversions?: number
          cost?: number
          cpc?: number
          created_at?: string
          ctr?: number
          date: string
          id?: string
          impressions?: number
          keyword: string
          match_type?: string
          quality_score?: number | null
          status?: string
        }
        Update: {
          campaign_sync_id?: string
          clicks?: number
          company_id?: string
          conversions?: number
          cost?: number
          cpc?: number
          created_at?: string
          ctr?: number
          date?: string
          id?: string
          impressions?: number
          keyword?: string
          match_type?: string
          quality_score?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_keywords_campaign_sync_id_fkey"
            columns: ["campaign_sync_id"]
            isOneToOne: false
            referencedRelation: "campaigns_sync"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_keywords_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_metrics: {
        Row: {
          campaign_sync_id: string
          clicks: number
          company_id: string
          conversion_value: number
          conversions: number
          cost: number
          cpa: number
          cpc: number
          created_at: string
          ctr: number
          date: string
          hour: number | null
          id: string
          impressions: number
          platform_data: Json
          roas: number
        }
        Insert: {
          campaign_sync_id: string
          clicks?: number
          company_id: string
          conversion_value?: number
          conversions?: number
          cost?: number
          cpa?: number
          cpc?: number
          created_at?: string
          ctr?: number
          date: string
          hour?: number | null
          id?: string
          impressions?: number
          platform_data?: Json
          roas?: number
        }
        Update: {
          campaign_sync_id?: string
          clicks?: number
          company_id?: string
          conversion_value?: number
          conversions?: number
          cost?: number
          cpa?: number
          cpc?: number
          created_at?: string
          ctr?: number
          date?: string
          hour?: number | null
          id?: string
          impressions?: number
          platform_data?: Json
          roas?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_metrics_campaign_sync_id_fkey"
            columns: ["campaign_sync_id"]
            isOneToOne: false
            referencedRelation: "campaigns_sync"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns_sync: {
        Row: {
          campaign_name: string
          company_id: string
          connection_id: string
          created_at: string
          currency: string
          daily_budget: number
          end_date: string | null
          external_campaign_id: string
          id: string
          last_sync_at: string | null
          platform: string
          start_date: string | null
          status: string
          total_budget: number
          updated_at: string
        }
        Insert: {
          campaign_name: string
          company_id: string
          connection_id: string
          created_at?: string
          currency?: string
          daily_budget?: number
          end_date?: string | null
          external_campaign_id: string
          id?: string
          last_sync_at?: string | null
          platform: string
          start_date?: string | null
          status?: string
          total_budget?: number
          updated_at?: string
        }
        Update: {
          campaign_name?: string
          company_id?: string
          connection_id?: string
          created_at?: string
          currency?: string
          daily_budget?: number
          end_date?: string | null
          external_campaign_id?: string
          id?: string
          last_sync_at?: string | null
          platform?: string
          start_date?: string | null
          status?: string
          total_budget?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_sync_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_sync_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "ad_connections_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_sync_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "ad_platform_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          domain: string
          id: string
          is_active: boolean
          logo_url: string | null
          max_seats: number
          name: string
          plan: string
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          max_seats?: number
          name: string
          plan?: string
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          max_seats?: number
          name?: string
          plan?: string
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "plan_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      content_types: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      invitations: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          first_name: string
          id: string
          invited_by: string | null
          last_name: string
          revoked_at: string | null
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          first_name?: string
          id?: string
          invited_by?: string | null
          last_name?: string
          revoked_at?: string | null
          role?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          first_name?: string
          id?: string
          invited_by?: string | null
          last_name?: string
          revoked_at?: string | null
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_company_id_fkey"
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
      oauth_states: {
        Row: {
          company_id: string
          created_at: string
          expires_at: string
          id: string
          platform: string
          state: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          expires_at?: string
          id?: string
          platform: string
          state?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          platform?: string
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      plan_definitions: {
        Row: {
          created_at: string | null
          display_name: string
          features: Json
          id: string
          is_active: boolean | null
          max_ad_connections: number | null
          max_campaigns_sync: number | null
          max_seats: number
          modules_included: string[]
          monthly_price_usd: number | null
          sort_order: number | null
          sync_interval_minutes: number | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          features?: Json
          id: string
          is_active?: boolean | null
          max_ad_connections?: number | null
          max_campaigns_sync?: number | null
          max_seats?: number
          modules_included?: string[]
          monthly_price_usd?: number | null
          sort_order?: number | null
          sync_interval_minutes?: number | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          features?: Json
          id?: string
          is_active?: boolean | null
          max_ad_connections?: number | null
          max_campaigns_sync?: number | null
          max_seats?: number
          modules_included?: string[]
          monthly_price_usd?: number | null
          sort_order?: number | null
          sync_interval_minutes?: number | null
        }
        Relationships: []
      }
      platform_domains: {
        Row: {
          created_at: string
          domain: string
        }
        Insert: {
          created_at?: string
          domain: string
        }
        Update: {
          created_at?: string
          domain?: string
        }
        Relationships: []
      }
      product_families: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_families_company_id_fkey"
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
          member_role: string
          member_status: string
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
          member_role?: string
          member_status?: string
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
          member_role?: string
          member_status?: string
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
      super_admin_impersonations: {
        Row: {
          ended_at: string | null
          id: string
          ip_address: string | null
          started_at: string
          super_admin_user_id: string
          target_company_id: string
          user_agent: string | null
        }
        Insert: {
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          started_at?: string
          super_admin_user_id: string
          target_company_id: string
          user_agent?: string | null
        }
        Update: {
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          started_at?: string
          super_admin_user_id?: string
          target_company_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "super_admin_impersonations_target_company_id_fkey"
            columns: ["target_company_id"]
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
      ad_connections_safe: {
        Row: {
          account_id: string | null
          account_name: string | null
          company_id: string | null
          connected_by: string | null
          created_at: string | null
          id: string | null
          last_sync_at: string | null
          platform: string | null
          status: string | null
          sync_interval_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          account_name?: string | null
          company_id?: string | null
          connected_by?: string | null
          created_at?: string | null
          id?: string | null
          last_sync_at?: string | null
          platform?: string | null
          status?: string | null
          sync_interval_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          account_name?: string | null
          company_id?: string | null
          connected_by?: string | null
          created_at?: string | null
          id?: string | null
          last_sync_at?: string | null
          platform?: string | null
          status?: string | null
          sync_interval_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_platform_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      end_impersonation: { Args: never; Returns: undefined }
      get_active_impersonation: { Args: { _user_id: string }; Returns: string }
      get_company_plan_limits: {
        Args: { _company_id: string }
        Returns: {
          max_ad_connections: number
          max_campaigns_sync: number
          max_seats: number
          modules_included: string[]
          plan_id: string
          sync_interval_minutes: number
        }[]
      }
      get_my_active_impersonation: {
        Args: never
        Returns: {
          company_name: string
          id: string
          started_at: string
          target_company_id: string
        }[]
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      get_user_email_domain: { Args: never; Returns: string }
      has_premium_plan: { Args: { _company_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_blocked_domain: { Args: { _domain: string }; Returns: boolean }
      is_platform_domain: { Args: { _domain: string }; Returns: boolean }
      is_protected_user: { Args: { _user_id: string }; Returns: boolean }
      start_impersonation: {
        Args: { _ip?: string; _target_company_id: string; _ua?: string }
        Returns: string
      }
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
