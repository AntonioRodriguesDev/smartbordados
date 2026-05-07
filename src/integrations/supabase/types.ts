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
      clients: {
        Row: {
          cnpj: string | null
          created_at: string
          dia_corte: number | null
          dia_pagamento_1: number | null
          dia_pagamento_2: number | null
          dias: string | null
          id: string
          nome: string
          tipo_condicao: string
          user_id: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          dia_corte?: number | null
          dia_pagamento_1?: number | null
          dia_pagamento_2?: number | null
          dias?: string | null
          id?: string
          nome: string
          tipo_condicao: string
          user_id: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          dia_corte?: number | null
          dia_pagamento_1?: number | null
          dia_pagamento_2?: number | null
          dias?: string | null
          id?: string
          nome?: string
          tipo_condicao?: string
          user_id?: string
        }
        Relationships: []
      }
      employee_payments: {
        Row: {
          created_at: string
          data_pagamento: string
          employee_id: string
          id: string
          observacao: string | null
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          data_pagamento?: string
          employee_id: string
          id?: string
          observacao?: string | null
          tipo?: string
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string
          data_pagamento?: string
          employee_id?: string
          id?: string
          observacao?: string | null
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      employee_skills: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          nivel: number
          nome: string
          user_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          nivel?: number
          nome: string
          user_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          nivel?: number
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      employee_vales: {
        Row: {
          created_at: string
          data: string
          descricao: string | null
          employee_id: string
          id: string
          quitado: boolean
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          descricao?: string | null
          employee_id: string
          id?: string
          quitado?: boolean
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string | null
          employee_id?: string
          id?: string
          quitado?: boolean
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      employees: {
        Row: {
          cargo: string | null
          cpf: string | null
          created_at: string
          data_admissao: string | null
          data_nascimento: string | null
          dia_pagamento: number | null
          email: string | null
          endereco: string | null
          foto_url: string | null
          id: string
          nome: string
          observacoes: string | null
          salario: number
          setor: string | null
          status: string
          telefone: string | null
          user_id: string
        }
        Insert: {
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          data_nascimento?: string | null
          dia_pagamento?: number | null
          email?: string | null
          endereco?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          salario?: number
          setor?: string | null
          status?: string
          telefone?: string | null
          user_id: string
        }
        Update: {
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          data_nascimento?: string | null
          dia_pagamento?: number | null
          email?: string | null
          endereco?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          salario?: number
          setor?: string | null
          status?: string
          telefone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          dias_uteis: number
          id: string
          mes: string
          user_id: string
          valor_meta: number
        }
        Insert: {
          created_at?: string
          dias_uteis: number
          id?: string
          mes: string
          user_id: string
          valor_meta: number
        }
        Update: {
          created_at?: string
          dias_uteis?: number
          id?: string
          mes?: string
          user_id?: string
          valor_meta?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string
          data_faturamento: string
          id: string
          numero: string
          user_id: string
          valor: number
        }
        Insert: {
          client_id: string
          created_at?: string
          data_faturamento: string
          id?: string
          numero: string
          user_id: string
          valor: number
        }
        Update: {
          client_id?: string
          created_at?: string
          data_faturamento?: string
          id?: string
          numero?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      receivables: {
        Row: {
          client_id: string
          created_at: string
          id: string
          invoice_id: string
          pago_em: string | null
          parcela: number
          status: string
          user_id: string
          valor: number
          vencimento: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          invoice_id: string
          pago_em?: string | null
          parcela?: number
          status?: string
          user_id: string
          valor: number
          vencimento: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          pago_em?: string | null
          parcela?: number
          status?: string
          user_id?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
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
