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
      contract_history: {
        Row: {
          action: string
          created_at: string | null
          created_by: string | null
          event_contract_id: string | null
          id: string
          new_data: Json | null
          previous_data: Json | null
        }
        Insert: {
          action: string
          created_at?: string | null
          created_by?: string | null
          event_contract_id?: string | null
          id?: string
          new_data?: Json | null
          previous_data?: Json | null
        }
        Update: {
          action?: string
          created_at?: string | null
          created_by?: string | null
          event_contract_id?: string | null
          id?: string
          new_data?: Json | null
          previous_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_history_event_contract_id_fkey"
            columns: ["event_contract_id"]
            isOneToOne: false
            referencedRelation: "event_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signature_history: {
        Row: {
          audit_url: string | null
          created_at: string | null
          event_contract_id: string | null
          id: string
          ip_address: string | null
          provider: string | null
          provider_document_id: string | null
          raw_payload: Json | null
          signature_status: string | null
          signed_at: string | null
          signer_email: string | null
          signer_name: string | null
          signer_role: string | null
        }
        Insert: {
          audit_url?: string | null
          created_at?: string | null
          event_contract_id?: string | null
          id?: string
          ip_address?: string | null
          provider?: string | null
          provider_document_id?: string | null
          raw_payload?: Json | null
          signature_status?: string | null
          signed_at?: string | null
          signer_email?: string | null
          signer_name?: string | null
          signer_role?: string | null
        }
        Update: {
          audit_url?: string | null
          created_at?: string | null
          event_contract_id?: string | null
          id?: string
          ip_address?: string | null
          provider?: string | null
          provider_document_id?: string | null
          raw_payload?: Json | null
          signature_status?: string | null
          signed_at?: string | null
          signer_email?: string | null
          signer_name?: string | null
          signer_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_signature_history_event_contract_id_fkey"
            columns: ["event_contract_id"]
            isOneToOne: false
            referencedRelation: "event_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signers: {
        Row: {
          address: string | null
          cpf: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      contract_templates: {
        Row: {
          created_at: string | null
          description: string | null
          file_path: string | null
          file_type: string | null
          file_url: string | null
          id: string
          is_default: boolean | null
          name: string
          status: string | null
          updated_at: string | null
          variables_schema: Json | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          file_path?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          status?: string | null
          updated_at?: string | null
          variables_schema?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          file_path?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          status?: string | null
          updated_at?: string | null
          variables_schema?: Json | null
        }
        Relationships: []
      }
      drinks: {
        Row: {
          categoria: string | null
          created_at: string
          custo_unitario: number
          descricao: string | null
          id: string
          imagem: string | null
          insumos: Json | null
          modality_config: Json | null
          nome: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          custo_unitario?: number
          descricao?: string | null
          id: string
          imagem?: string | null
          insumos?: Json | null
          modality_config?: Json | null
          nome: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          custo_unitario?: number
          descricao?: string | null
          id?: string
          imagem?: string | null
          insumos?: Json | null
          modality_config?: Json | null
          nome?: string
        }
        Relationships: []
      }
      event_budget_history: {
        Row: {
          action: string
          budget_version_id: string | null
          changed_fields: Json | null
          created_at: string | null
          created_by: string | null
          discount_applied: number | null
          event_id: string
          id: string
          new_data: Json | null
          new_final_value: number | null
          previous_data: Json | null
          previous_final_value: number | null
        }
        Insert: {
          action: string
          budget_version_id?: string | null
          changed_fields?: Json | null
          created_at?: string | null
          created_by?: string | null
          discount_applied?: number | null
          event_id: string
          id?: string
          new_data?: Json | null
          new_final_value?: number | null
          previous_data?: Json | null
          previous_final_value?: number | null
        }
        Update: {
          action?: string
          budget_version_id?: string | null
          changed_fields?: Json | null
          created_at?: string | null
          created_by?: string | null
          discount_applied?: number | null
          event_id?: string
          id?: string
          new_data?: Json | null
          new_final_value?: number | null
          previous_data?: Json | null
          previous_final_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_budget_history_budget_version_id_fkey"
            columns: ["budget_version_id"]
            isOneToOne: false
            referencedRelation: "event_budget_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_budget_history_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_budget_versions: {
        Row: {
          average_drink_cost: number | null
          average_value_per_person: number | null
          bartender_quantity: number | null
          bartender_unit_value: number | null
          copeira_quantity: number | null
          copeira_unit_value: number | null
          created_at: string | null
          created_by: string | null
          discount_description: string | null
          discount_value: number | null
          drinks_base_cost: number | null
          drinks_cost_sum: number | null
          drinks_final_value: number | null
          drinks_markup_percentage: number | null
          drinks_per_person: number | null
          event_id: string
          final_budget_value: number | null
          fuel_value: number | null
          has_travel: boolean | null
          ice_package_unit_value: number | null
          ice_packages_quantity: number | null
          ice_total_value: number | null
          id: string
          is_current: boolean | null
          keeper_quantity: number | null
          keeper_unit_value: number | null
          miscellaneous_items: Json | null
          miscellaneous_total_value: number | null
          paid_percentage: number | null
          paid_value: number | null
          payment_method: string | null
          pending_payment_date: string | null
          pending_percentage: number | null
          pending_value: number | null
          profit_value: number | null
          selected_drinks: Json | null
          status: string | null
          team_total_value: number | null
          updated_at: string | null
          version_number: number
        }
        Insert: {
          average_drink_cost?: number | null
          average_value_per_person?: number | null
          bartender_quantity?: number | null
          bartender_unit_value?: number | null
          copeira_quantity?: number | null
          copeira_unit_value?: number | null
          created_at?: string | null
          created_by?: string | null
          discount_description?: string | null
          discount_value?: number | null
          drinks_base_cost?: number | null
          drinks_cost_sum?: number | null
          drinks_final_value?: number | null
          drinks_markup_percentage?: number | null
          drinks_per_person?: number | null
          event_id: string
          final_budget_value?: number | null
          fuel_value?: number | null
          has_travel?: boolean | null
          ice_package_unit_value?: number | null
          ice_packages_quantity?: number | null
          ice_total_value?: number | null
          id?: string
          is_current?: boolean | null
          keeper_quantity?: number | null
          keeper_unit_value?: number | null
          miscellaneous_items?: Json | null
          miscellaneous_total_value?: number | null
          paid_percentage?: number | null
          paid_value?: number | null
          payment_method?: string | null
          pending_payment_date?: string | null
          pending_percentage?: number | null
          pending_value?: number | null
          profit_value?: number | null
          selected_drinks?: Json | null
          status?: string | null
          team_total_value?: number | null
          updated_at?: string | null
          version_number: number
        }
        Update: {
          average_drink_cost?: number | null
          average_value_per_person?: number | null
          bartender_quantity?: number | null
          bartender_unit_value?: number | null
          copeira_quantity?: number | null
          copeira_unit_value?: number | null
          created_at?: string | null
          created_by?: string | null
          discount_description?: string | null
          discount_value?: number | null
          drinks_base_cost?: number | null
          drinks_cost_sum?: number | null
          drinks_final_value?: number | null
          drinks_markup_percentage?: number | null
          drinks_per_person?: number | null
          event_id?: string
          final_budget_value?: number | null
          fuel_value?: number | null
          has_travel?: boolean | null
          ice_package_unit_value?: number | null
          ice_packages_quantity?: number | null
          ice_total_value?: number | null
          id?: string
          is_current?: boolean | null
          keeper_quantity?: number | null
          keeper_unit_value?: number | null
          miscellaneous_items?: Json | null
          miscellaneous_total_value?: number | null
          paid_percentage?: number | null
          paid_value?: number | null
          payment_method?: string | null
          pending_payment_date?: string | null
          pending_percentage?: number | null
          pending_value?: number | null
          profit_value?: number | null
          selected_drinks?: Json | null
          status?: string | null
          team_total_value?: number | null
          updated_at?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_budget_versions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_contract_client_data: {
        Row: {
          address: string | null
          client_name: string | null
          cpf_cnpj: string | null
          created_at: string | null
          email: string | null
          event_id: string
          id: string
          legal_representative_cpf: string | null
          legal_representative_name: string | null
          notes: string | null
          phone: string | null
          public_token: string | null
          submitted_at: string | null
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          client_name?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          email?: string | null
          event_id: string
          id?: string
          legal_representative_cpf?: string | null
          legal_representative_name?: string | null
          notes?: string | null
          phone?: string | null
          public_token?: string | null
          submitted_at?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          client_name?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          email?: string | null
          event_id?: string
          id?: string
          legal_representative_cpf?: string | null
          legal_representative_name?: string | null
          notes?: string | null
          phone?: string | null
          public_token?: string | null
          submitted_at?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      event_contracts: {
        Row: {
          created_at: string | null
          event_id: string
          external_id: string | null
          fully_signed_at: string | null
          generated_at: string | null
          generated_file_path: string | null
          generated_file_url: string | null
          id: string
          provider: string | null
          provider_document_id: string | null
          sent_for_signature_at: string | null
          signature_certificate_path: string | null
          signature_certificate_url: string | null
          signed_file_path: string | null
          signed_file_url: string | null
          signer_id: string | null
          status: string | null
          template_id: string | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          external_id?: string | null
          fully_signed_at?: string | null
          generated_at?: string | null
          generated_file_path?: string | null
          generated_file_url?: string | null
          id?: string
          provider?: string | null
          provider_document_id?: string | null
          sent_for_signature_at?: string | null
          signature_certificate_path?: string | null
          signature_certificate_url?: string | null
          signed_file_path?: string | null
          signed_file_url?: string | null
          signer_id?: string | null
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          external_id?: string | null
          fully_signed_at?: string | null
          generated_at?: string | null
          generated_file_path?: string | null
          generated_file_url?: string | null
          id?: string
          provider?: string | null
          provider_document_id?: string | null
          sent_for_signature_at?: string | null
          signature_certificate_path?: string | null
          signature_certificate_url?: string | null
          signed_file_path?: string | null
          signed_file_url?: string | null
          signer_id?: string | null
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_contracts_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "contract_signers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      event_drink_glassware: {
        Row: {
          created_at: string | null
          drink_id: string
          event_id: string
          glassware_id: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          drink_id: string
          event_id: string
          glassware_id?: string | null
          id?: string
        }
        Update: {
          created_at?: string | null
          drink_id?: string
          event_id?: string
          glassware_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_drink_glassware_glassware_id_fkey"
            columns: ["glassware_id"]
            isOneToOne: false
            referencedRelation: "glassware"
            referencedColumns: ["id"]
          },
        ]
      }
      event_negotiation_history: {
        Row: {
          created_at: string | null
          created_by: string | null
          event_id: string
          id: string
          note: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          event_id: string
          id?: string
          note?: string | null
          status: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          event_id?: string
          id?: string
          note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_negotiation_history_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          city: string | null
          client_name: string
          created_at: string | null
          current_budget_value: number | null
          current_profit_value: number | null
          date: string
          drinks: string[] | null
          email: string | null
          event_location: string | null
          event_time: string | null
          event_type: string
          guests: number
          id: string
          is_paid_full: boolean
          lead_source: string | null
          notes: string | null
          payment_due_date: string | null
          payment_percent_received: number | null
          phone: string | null
          referral_name: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          city?: string | null
          client_name: string
          created_at?: string | null
          current_budget_value?: number | null
          current_profit_value?: number | null
          date: string
          drinks?: string[] | null
          email?: string | null
          event_location?: string | null
          event_time?: string | null
          event_type: string
          guests?: number
          id?: string
          is_paid_full?: boolean
          lead_source?: string | null
          notes?: string | null
          payment_due_date?: string | null
          payment_percent_received?: number | null
          phone?: string | null
          referral_name?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          city?: string | null
          client_name?: string
          created_at?: string | null
          current_budget_value?: number | null
          current_profit_value?: number | null
          date?: string
          drinks?: string[] | null
          email?: string | null
          event_location?: string | null
          event_time?: string | null
          event_type?: string
          guests?: number
          id?: string
          is_paid_full?: boolean
          lead_source?: string | null
          notes?: string | null
          payment_due_date?: string | null
          payment_percent_received?: number | null
          phone?: string | null
          referral_name?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      financial_expense_receipt_logs: {
        Row: {
          auto_filled_fields: string[]
          expense_id: string | null
          id: string
          is_ocr_generated: boolean
          manually_edited_fields: string[]
          metadata: Json
          reading_error: string | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          auto_filled_fields?: string[]
          expense_id?: string | null
          id?: string
          is_ocr_generated?: boolean
          manually_edited_fields?: string[]
          metadata?: Json
          reading_error?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          auto_filled_fields?: string[]
          expense_id?: string | null
          id?: string
          is_ocr_generated?: boolean
          manually_edited_fields?: string[]
          metadata?: Json
          reading_error?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_expense_receipt_logs_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "financial_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_expenses: {
        Row: {
          amount: number
          auto_filled_fields: string[]
          category: string
          classification: string
          cost_center: string | null
          created_at: string | null
          date: string
          description: string
          due_date: string | null
          expense_type: string
          id: string
          invoice_url: string | null
          manually_edited_fields: string[]
          modality: string
          ocr_metadata: Json
          ocr_raw_text: string | null
          payment_method: string
          payment_source: string | null
          receipt_url: string | null
          responsible: string
          review_status: string
          staff_name: string | null
          staff_role: string | null
          status: string
          supplier_cnpj: string | null
          supplier_name: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number
          auto_filled_fields?: string[]
          category: string
          classification?: string
          cost_center?: string | null
          created_at?: string | null
          date: string
          description: string
          due_date?: string | null
          expense_type?: string
          id?: string
          invoice_url?: string | null
          manually_edited_fields?: string[]
          modality: string
          ocr_metadata?: Json
          ocr_raw_text?: string | null
          payment_method: string
          payment_source?: string | null
          receipt_url?: string | null
          responsible: string
          review_status?: string
          staff_name?: string | null
          staff_role?: string | null
          status?: string
          supplier_cnpj?: string | null
          supplier_name?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          auto_filled_fields?: string[]
          category?: string
          classification?: string
          cost_center?: string | null
          created_at?: string | null
          date?: string
          description?: string
          due_date?: string | null
          expense_type?: string
          id?: string
          invoice_url?: string | null
          manually_edited_fields?: string[]
          modality?: string
          ocr_metadata?: Json
          ocr_raw_text?: string | null
          payment_method?: string
          payment_source?: string | null
          receipt_url?: string | null
          responsible?: string
          review_status?: string
          staff_name?: string | null
          staff_role?: string | null
          status?: string
          supplier_cnpj?: string | null
          supplier_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      financial_session_items: {
        Row: {
          created_at: string | null
          drink_id: string | null
          drink_name: string
          id: string
          ingredient_cost: number | null
          quantity: number
          session_id: string
          unit_cost: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          drink_id?: string | null
          drink_name: string
          id?: string
          ingredient_cost?: number | null
          quantity?: number
          session_id: string
          unit_cost?: number
          unit_price?: number
        }
        Update: {
          created_at?: string | null
          drink_id?: string | null
          drink_name?: string
          id?: string
          ingredient_cost?: number | null
          quantity?: number
          session_id?: string
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_session_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "financial_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_sessions: {
        Row: {
          created_at: string | null
          custos_restaurante_detalhes: Json | null
          date: string
          id: string
          labor_details: Json | null
          labor_names: string | null
          labor_quantity: number | null
          labor_value: number | null
          modality: string
          reposicao_restaurante: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custos_restaurante_detalhes?: Json | null
          date?: string
          id?: string
          labor_details?: Json | null
          labor_names?: string | null
          labor_quantity?: number | null
          labor_value?: number | null
          modality: string
          reposicao_restaurante?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custos_restaurante_detalhes?: Json | null
          date?: string
          id?: string
          labor_details?: Json | null
          labor_names?: string | null
          labor_quantity?: number | null
          labor_value?: number | null
          modality?: string
          reposicao_restaurante?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      generated_proposals: {
        Row: {
          budget_id: string | null
          created_at: string | null
          event_id: string
          final_pdf_url: string | null
          id: string
          proposal_data: Json
          status: string
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          budget_id?: string | null
          created_at?: string | null
          event_id: string
          final_pdf_url?: string | null
          id?: string
          proposal_data?: Json
          status?: string
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          budget_id?: string | null
          created_at?: string | null
          event_id?: string
          final_pdf_url?: string | null
          id?: string
          proposal_data?: Json
          status?: string
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_proposals_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "event_budget_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_proposals_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_proposals_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "proposal_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      glassware: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          replacement_value: number | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          replacement_value?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          replacement_value?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          category: string
          cost_per_unit: number
          created_at: string | null
          id: string
          name: string
          quantity: number
          unit: string
          updated_at: string
        }
        Insert: {
          category: string
          cost_per_unit?: number
          created_at?: string | null
          id?: string
          name: string
          quantity?: number
          unit: string
          updated_at?: string
        }
        Update: {
          category?: string
          cost_per_unit?: number
          created_at?: string | null
          id?: string
          name?: string
          quantity?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string
          id: string
          inventory_id: string
          quantity: number
          source: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_id: string
          quantity: number
          source: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_id?: string
          quantity?: number
          source?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proposal_templates: {
        Row: {
          created_at: string | null
          event_type: string
          file_url: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sales: {
        Row: {
          created_at: string | null
          date: string
          id: string
          location: string
          total_cost: number
          total_profit: number
          total_revenue: number
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          location: string
          total_cost?: number
          total_profit?: number
          total_revenue?: number
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          location?: string
          total_cost?: number
          total_profit?: number
          total_revenue?: number
        }
        Relationships: []
      }
      sales_items: {
        Row: {
          cost: number
          created_at: string | null
          drink_id: string
          id: string
          price: number
          quantity: number
          sale_id: string
        }
        Insert: {
          cost: number
          created_at?: string | null
          drink_id: string
          id?: string
          price: number
          quantity: number
          sale_id: string
        }
        Update: {
          cost?: number
          created_at?: string | null
          drink_id?: string
          id?: string
          price?: number
          quantity?: number
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_items_drink_id_fkey"
            columns: ["drink_id"]
            isOneToOne: false
            referencedRelation: "drinks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
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
