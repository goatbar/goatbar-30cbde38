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
      ai_action_logs: {
        Row: {
          action: string
          ai_inbox_item_id: string | null
          automatic: boolean
          created_at: string
          error_message: string | null
          event_id: string | null
          id: string
          new_data: Json | null
          performed_by: string | null
          performer_name: string | null
          previous_data: Json | null
        }
        Insert: {
          action: string
          ai_inbox_item_id?: string | null
          automatic?: boolean
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          id?: string
          new_data?: Json | null
          performed_by?: string | null
          performer_name?: string | null
          previous_data?: Json | null
        }
        Update: {
          action?: string
          ai_inbox_item_id?: string | null
          automatic?: boolean
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          id?: string
          new_data?: Json | null
          performed_by?: string | null
          performer_name?: string | null
          previous_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_action_logs_ai_inbox_item_id_fkey"
            columns: ["ai_inbox_item_id"]
            isOneToOne: false
            referencedRelation: "ai_inbox_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_action_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_circuit_breakers: {
        Row: {
          consecutive_failures: number
          cooldown_until: string | null
          last_failure_reason: string | null
          last_status_code: number | null
          opened_at: string | null
          provider_id: string
          state: string
          updated_at: string
        }
        Insert: {
          consecutive_failures?: number
          cooldown_until?: string | null
          last_failure_reason?: string | null
          last_status_code?: number | null
          opened_at?: string | null
          provider_id: string
          state?: string
          updated_at?: string
        }
        Update: {
          consecutive_failures?: number
          cooldown_until?: string | null
          last_failure_reason?: string | null
          last_status_code?: number | null
          opened_at?: string | null
          provider_id?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_circuit_breakers_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversation_locks: {
        Row: {
          active_turn_id: string
          conversation_id: string
          expires_at: string
          locked_at: string
        }
        Insert: {
          active_turn_id: string
          conversation_id: string
          expires_at?: string
          locked_at?: string
        }
        Update: {
          active_turn_id?: string
          conversation_id?: string
          expires_at?: string
          locked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversation_locks_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          channel: string
          created_at: string
          external_conversation_id: string | null
          id: string
          metadata: Json
          status: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          external_conversation_id?: string | null
          id?: string
          metadata?: Json
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          external_conversation_id?: string | null
          id?: string
          metadata?: Json
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_inbox_attachments: {
        Row: {
          ai_inbox_item_id: string
          attachment_type: string
          created_at: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          storage_path: string
        }
        Insert: {
          ai_inbox_item_id: string
          attachment_type: string
          created_at?: string
          file_name: string
          file_size?: number
          id?: string
          mime_type: string
          storage_path: string
        }
        Update: {
          ai_inbox_item_id?: string
          attachment_type?: string
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_inbox_attachments_ai_inbox_item_id_fkey"
            columns: ["ai_inbox_item_id"]
            isOneToOne: false
            referencedRelation: "ai_inbox_items"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_inbox_items: {
        Row: {
          applied_at: string | null
          applied_entity_id: string | null
          applied_entity_type: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          classification: string
          classification_confidence: number
          created_at: string
          error_message: string | null
          event_match_confidence: number
          extraction_confidence: number
          id: string
          matched_event_id: string | null
          matched_location_id: string | null
          matched_supplier_id: string | null
          message_type: string
          processed_at: string | null
          processing_mode: string
          processing_status: string
          provider_metadata: Json
          raw_text: string | null
          received_at: string
          source: string
          source_conversation_id: string | null
          source_message_id: string | null
          source_sender_id: string | null
          source_sender_name: string | null
          structured_data: Json
          transcribed_text: string | null
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          applied_entity_id?: string | null
          applied_entity_type?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          classification?: string
          classification_confidence?: number
          created_at?: string
          error_message?: string | null
          event_match_confidence?: number
          extraction_confidence?: number
          id?: string
          matched_event_id?: string | null
          matched_location_id?: string | null
          matched_supplier_id?: string | null
          message_type?: string
          processed_at?: string | null
          processing_mode?: string
          processing_status?: string
          provider_metadata?: Json
          raw_text?: string | null
          received_at?: string
          source: string
          source_conversation_id?: string | null
          source_message_id?: string | null
          source_sender_id?: string | null
          source_sender_name?: string | null
          structured_data?: Json
          transcribed_text?: string | null
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          applied_entity_id?: string | null
          applied_entity_type?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          classification?: string
          classification_confidence?: number
          created_at?: string
          error_message?: string | null
          event_match_confidence?: number
          extraction_confidence?: number
          id?: string
          matched_event_id?: string | null
          matched_location_id?: string | null
          matched_supplier_id?: string | null
          message_type?: string
          processed_at?: string | null
          processing_mode?: string
          processing_status?: string
          provider_metadata?: Json
          raw_text?: string | null
          received_at?: string
          source?: string
          source_conversation_id?: string | null
          source_message_id?: string | null
          source_sender_id?: string | null
          source_sender_name?: string | null
          structured_data?: Json
          transcribed_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_inbox_items_matched_event_id_fkey"
            columns: ["matched_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          attachment_metadata: Json | null
          attachment_url: string | null
          content: string
          conversation_id: string
          created_at: string
          external_message_id: string | null
          id: string
          message_type: string
          role: string
          sender_name: string | null
          tokens_used: number | null
        }
        Insert: {
          attachment_metadata?: Json | null
          attachment_url?: string | null
          content?: string
          conversation_id: string
          created_at?: string
          external_message_id?: string | null
          id?: string
          message_type?: string
          role: string
          sender_name?: string | null
          tokens_used?: number | null
        }
        Update: {
          attachment_metadata?: Json | null
          attachment_url?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          external_message_id?: string | null
          id?: string
          message_type?: string
          role?: string
          sender_name?: string | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_models: {
        Row: {
          context_window: number | null
          created_at: string
          free_tier: boolean
          id: string
          is_default: boolean
          model_name: string
          provider_id: string
          supports_tools: boolean
          supports_vision: boolean
        }
        Insert: {
          context_window?: number | null
          created_at?: string
          free_tier?: boolean
          id: string
          is_default?: boolean
          model_name: string
          provider_id: string
          supports_tools?: boolean
          supports_vision?: boolean
        }
        Update: {
          context_window?: number | null
          created_at?: string
          free_tier?: boolean
          id?: string
          is_default?: boolean
          model_name?: string
          provider_id?: string
          supports_tools?: boolean
          supports_vision?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_models_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_notification_reads: {
        Row: {
          ai_inbox_item_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          ai_inbox_item_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          ai_inbox_item_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_notification_reads_ai_inbox_item_id_fkey"
            columns: ["ai_inbox_item_id"]
            isOneToOne: false
            referencedRelation: "ai_inbox_items"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_pending_actions: {
        Row: {
          arguments: Json
          conversation_id: string
          created_at: string
          error: string | null
          execution_id: string | null
          expires_at: string
          id: string
          missing_fields: string[]
          result: Json | null
          status: string
          summary: string | null
          tool_name: string
          updated_at: string
        }
        Insert: {
          arguments?: Json
          conversation_id: string
          created_at?: string
          error?: string | null
          execution_id?: string | null
          expires_at?: string
          id?: string
          missing_fields?: string[]
          result?: Json | null
          status?: string
          summary?: string | null
          tool_name: string
          updated_at?: string
        }
        Update: {
          arguments?: Json
          conversation_id?: string
          created_at?: string
          error?: string | null
          execution_id?: string | null
          expires_at?: string
          id?: string
          missing_fields?: string[]
          result?: Json | null
          status?: string
          summary?: string | null
          tool_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_pending_actions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_providers: {
        Row: {
          cooldown_until: string | null
          created_at: string
          enabled: boolean
          free_type: string
          id: string
          last_error_at: string | null
          last_error_message: string | null
          last_success_at: string | null
          metadata: Json
          name: string
          priority: number
          status: string
          supports_audio: boolean
          supports_streaming: boolean
          supports_structured_output: boolean
          supports_text: boolean
          supports_tools: boolean
          supports_vision: boolean
          updated_at: string
        }
        Insert: {
          cooldown_until?: string | null
          created_at?: string
          enabled?: boolean
          free_type?: string
          id: string
          last_error_at?: string | null
          last_error_message?: string | null
          last_success_at?: string | null
          metadata?: Json
          name: string
          priority?: number
          status?: string
          supports_audio?: boolean
          supports_streaming?: boolean
          supports_structured_output?: boolean
          supports_text?: boolean
          supports_tools?: boolean
          supports_vision?: boolean
          updated_at?: string
        }
        Update: {
          cooldown_until?: string | null
          created_at?: string
          enabled?: boolean
          free_type?: string
          id?: string
          last_error_at?: string | null
          last_error_message?: string | null
          last_success_at?: string | null
          metadata?: Json
          name?: string
          priority?: number
          status?: string
          supports_audio?: boolean
          supports_streaming?: boolean
          supports_structured_output?: boolean
          supports_text?: boolean
          supports_tools?: boolean
          supports_vision?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ai_tool_calls: {
        Row: {
          arguments: Json
          conversation_id: string
          duration_ms: number | null
          error: string | null
          finished_at: string | null
          id: string
          message_id: string | null
          performed_by: string | null
          result: Json | null
          started_at: string
          status: string
          tool_name: string
        }
        Insert: {
          arguments?: Json
          conversation_id: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          message_id?: string | null
          performed_by?: string | null
          result?: Json | null
          started_at?: string
          status?: string
          tool_name: string
        }
        Update: {
          arguments?: Json
          conversation_id?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          message_id?: string | null
          performed_by?: string | null
          result?: Json | null
          started_at?: string
          status?: string
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_tool_calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_tool_calls_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ai_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_turns: {
        Row: {
          assistant_message_id: string | null
          completed_at: string | null
          conversation_id: string
          created_at: string
          current_stage: string
          error_message: string | null
          error_type: string | null
          failed_at: string | null
          id: string
          model_id: string | null
          provider_id: string | null
          reply: string | null
          request_id: string | null
          started_at: string
          status: string
          timings: Json
          tools_executed: string[] | null
          updated_at: string
          user_message_id: string | null
        }
        Insert: {
          assistant_message_id?: string | null
          completed_at?: string | null
          conversation_id: string
          created_at?: string
          current_stage?: string
          error_message?: string | null
          error_type?: string | null
          failed_at?: string | null
          id: string
          model_id?: string | null
          provider_id?: string | null
          reply?: string | null
          request_id?: string | null
          started_at?: string
          status?: string
          timings?: Json
          tools_executed?: string[] | null
          updated_at?: string
          user_message_id?: string | null
        }
        Update: {
          assistant_message_id?: string | null
          completed_at?: string | null
          conversation_id?: string
          created_at?: string
          current_stage?: string
          error_message?: string | null
          error_type?: string | null
          failed_at?: string | null
          id?: string
          model_id?: string | null
          provider_id?: string | null
          reply?: string | null
          request_id?: string | null
          started_at?: string
          status?: string
          timings?: Json
          tools_executed?: string[] | null
          updated_at?: string
          user_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_turns_assistant_message_id_fkey"
            columns: ["assistant_message_id"]
            isOneToOne: false
            referencedRelation: "ai_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_turns_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_turns_user_message_id_fkey"
            columns: ["user_message_id"]
            isOneToOne: false
            referencedRelation: "ai_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_events: {
        Row: {
          attempt: number
          conversation_id: string | null
          correlation_id: string
          created_at: string
          duration_ms: number
          error_message: string | null
          error_type: string | null
          id: string
          input_tokens: number | null
          model_id: string
          output_tokens: number | null
          provider_id: string
          status: string
          tools_executed: string[] | null
        }
        Insert: {
          attempt?: number
          conversation_id?: string | null
          correlation_id: string
          created_at?: string
          duration_ms?: number
          error_message?: string | null
          error_type?: string | null
          id?: string
          input_tokens?: number | null
          model_id: string
          output_tokens?: number | null
          provider_id: string
          status: string
          tools_executed?: string[] | null
        }
        Update: {
          attempt?: number
          conversation_id?: string | null
          correlation_id?: string
          created_at?: string
          duration_ms?: number
          error_message?: string | null
          error_type?: string | null
          id?: string
          input_tokens?: number | null
          model_id?: string
          output_tokens?: number | null
          provider_id?: string
          status?: string
          tools_executed?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_request_links: {
        Row: {
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          event_id: string | null
          expires_at: string | null
          id: string
          metadata: Json
          notification_error: string | null
          notification_sent_at: string | null
          notification_status: string
          status: string
          token: string
          used_at: string | null
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          notification_error?: string | null
          notification_sent_at?: string | null
          notification_status?: string
          status?: string
          token: string
          used_at?: string | null
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          notification_error?: string | null
          notification_sent_at?: string | null
          notification_status?: string
          status?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_request_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_request_notification_deliveries: {
        Row: {
          error_category: string | null
          error_message: string | null
          notification_id: string
          provider_message_id: string | null
          recipient_phone: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          error_category?: string | null
          error_message?: string | null
          notification_id: string
          provider_message_id?: string | null
          recipient_phone: string
          sent_at?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          error_category?: string | null
          error_message?: string | null
          notification_id?: string
          provider_message_id?: string | null
          recipient_phone?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_request_notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "budget_request_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_request_notifications: {
        Row: {
          created_at: string
          error: string | null
          error_category: string | null
          event_id: string
          id: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          error_category?: string | null
          event_id: string
          id?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          error_category?: string | null
          event_id?: string
          id?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_request_notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_sync_internal_config: {
        Row: {
          created_at: string
          id: string
          secret_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          secret_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          secret_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      canva_integrations: {
        Row: {
          access_token: string
          access_token_expires_at: string
          canva_user_id: string | null
          created_at: string
          id: string
          refresh_token: string
          scopes: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          access_token_expires_at: string
          canva_user_id?: string | null
          created_at?: string
          id?: string
          refresh_token: string
          scopes?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          access_token_expires_at?: string
          canva_user_id?: string | null
          created_at?: string
          id?: string
          refresh_token?: string
          scopes?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      canva_oauth_sessions: {
        Row: {
          code_verifier: string
          created_at: string
          expires_at: string
          id: string
          state: string
          user_id: string
        }
        Insert: {
          code_verifier: string
          created_at?: string
          expires_at: string
          id?: string
          state: string
          user_id: string
        }
        Update: {
          code_verifier?: string
          created_at?: string
          expires_at?: string
          id?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      contract_addendums: {
        Row: {
          addendum_date: string
          addendum_number: number
          balance_due_dates: Json
          balance_payment_condition: string | null
          balance_payment_method: string | null
          base_budget_version_id: string | null
          cancelled_at: string | null
          comparison_snapshot: Json
          contract_id: string
          contractant_snapshot: Json
          contracted_snapshot: Json
          created_at: string
          current_snapshot: Json
          event_id: string
          external_assignment_id: string | null
          external_document_id: string | null
          financial_snapshot: Json
          fully_signed_at: string | null
          generated_file_url: string | null
          generated_html: string | null
          id: string
          original_contract_date: string
          previous_snapshot: Json
          sent_for_signature_at: string | null
          signed_file_url: string | null
          signer_id: string | null
          status: string
          template_id: string | null
          updated_at: string
          updated_budget_version_id: string | null
        }
        Insert: {
          addendum_date?: string
          addendum_number?: number
          balance_due_dates?: Json
          balance_payment_condition?: string | null
          balance_payment_method?: string | null
          base_budget_version_id?: string | null
          cancelled_at?: string | null
          comparison_snapshot?: Json
          contract_id: string
          contractant_snapshot?: Json
          contracted_snapshot?: Json
          created_at?: string
          current_snapshot?: Json
          event_id: string
          external_assignment_id?: string | null
          external_document_id?: string | null
          financial_snapshot?: Json
          fully_signed_at?: string | null
          generated_file_url?: string | null
          generated_html?: string | null
          id?: string
          original_contract_date: string
          previous_snapshot?: Json
          sent_for_signature_at?: string | null
          signed_file_url?: string | null
          signer_id?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
          updated_budget_version_id?: string | null
        }
        Update: {
          addendum_date?: string
          addendum_number?: number
          balance_due_dates?: Json
          balance_payment_condition?: string | null
          balance_payment_method?: string | null
          base_budget_version_id?: string | null
          cancelled_at?: string | null
          comparison_snapshot?: Json
          contract_id?: string
          contractant_snapshot?: Json
          contracted_snapshot?: Json
          created_at?: string
          current_snapshot?: Json
          event_id?: string
          external_assignment_id?: string | null
          external_document_id?: string | null
          financial_snapshot?: Json
          fully_signed_at?: string | null
          generated_file_url?: string | null
          generated_html?: string | null
          id?: string
          original_contract_date?: string
          previous_snapshot?: Json
          sent_for_signature_at?: string | null
          signed_file_url?: string | null
          signer_id?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
          updated_budget_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_addendums_base_budget_version_id_fkey"
            columns: ["base_budget_version_id"]
            isOneToOne: false
            referencedRelation: "event_budget_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_addendums_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "event_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_addendums_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_addendums_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "contract_signers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_addendums_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_addendums_updated_budget_version_id_fkey"
            columns: ["updated_budget_version_id"]
            isOneToOne: false
            referencedRelation: "event_budget_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_documents: {
        Row: {
          addendum_id: string | null
          archive_status: string
          contract_id: string | null
          contract_version: number | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          document_name: string
          document_type: string
          event_id: string
          external_assignment_id: string | null
          external_document_id: string | null
          external_url: string | null
          file_hash: string | null
          file_size: number | null
          id: string
          is_final: boolean
          is_signed: boolean
          manual_signature_date: string | null
          mime_type: string | null
          original_filename: string | null
          signed_at: string | null
          source: string
          storage_bucket: string
          storage_path: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          addendum_id?: string | null
          archive_status?: string
          contract_id?: string | null
          contract_version?: number | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          document_name: string
          document_type: string
          event_id: string
          external_assignment_id?: string | null
          external_document_id?: string | null
          external_url?: string | null
          file_hash?: string | null
          file_size?: number | null
          id?: string
          is_final?: boolean
          is_signed?: boolean
          manual_signature_date?: string | null
          mime_type?: string | null
          original_filename?: string | null
          signed_at?: string | null
          source?: string
          storage_bucket?: string
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          addendum_id?: string | null
          archive_status?: string
          contract_id?: string | null
          contract_version?: number | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          document_name?: string
          document_type?: string
          event_id?: string
          external_assignment_id?: string | null
          external_document_id?: string | null
          external_url?: string | null
          file_hash?: string | null
          file_size?: number | null
          id?: string
          is_final?: boolean
          is_signed?: boolean
          manual_signature_date?: string | null
          mime_type?: string | null
          original_filename?: string | null
          signed_at?: string | null
          source?: string
          storage_bucket?: string
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_documents_addendum_id_fkey"
            columns: ["addendum_id"]
            isOneToOne: false
            referencedRelation: "contract_addendums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "event_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
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
      contract_signature_events: {
        Row: {
          contract_id: string | null
          event_type: string
          external_event_id: string
          id: string
          payload: Json
          processed_at: string | null
          processing_error: string | null
          received_at: string
          status: string
        }
        Insert: {
          contract_id?: string | null
          event_type: string
          external_event_id: string
          id?: string
          payload: Json
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          status?: string
        }
        Update: {
          contract_id?: string | null
          event_type?: string
          external_event_id?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_signature_events_contract_id_fkey"
            columns: ["contract_id"]
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
      contract_signature_reconciliations: {
        Row: {
          action: string
          admin_user_id: string
          associated_external_id: string | null
          created_at: string
          id: string
          new_status: string
          previous_status: string | null
          reason: string
          request_id: string
        }
        Insert: {
          action: string
          admin_user_id: string
          associated_external_id?: string | null
          created_at?: string
          id?: string
          new_status: string
          previous_status?: string | null
          reason: string
          request_id: string
        }
        Update: {
          action?: string
          admin_user_id?: string
          associated_external_id?: string | null
          created_at?: string
          id?: string
          new_status?: string
          previous_status?: string | null
          reason?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_signature_reconciliations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "contract_signature_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signature_requests: {
        Row: {
          addendum_id: string | null
          callback_payload: Json | null
          cancelled_at: string | null
          completed_at: string | null
          contract_id: string
          contract_version_id: number | null
          created_at: string
          dispatch_status: string
          document_kind: string
          error_code: string | null
          error_message: string | null
          event_id: string
          evidence_payload: Json | null
          expires_at: string | null
          external_assignment_id: string | null
          external_document_id: string | null
          external_request_id: string | null
          id: string
          internal_status: string
          last_error: string | null
          last_synced_at: string | null
          original_file_hash: string | null
          original_file_path: string | null
          provider: string
          provider_response: Json | null
          provider_status: string | null
          sent_at: string | null
          signature_provider: string | null
          signature_url: string | null
          signed_at: string | null
          signed_file_hash: string | null
          signed_file_path: string | null
          signer_document: string | null
          signer_email: string | null
          signer_name: string | null
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          addendum_id?: string | null
          callback_payload?: Json | null
          cancelled_at?: string | null
          completed_at?: string | null
          contract_id: string
          contract_version_id?: number | null
          created_at?: string
          dispatch_status?: string
          document_kind?: string
          error_code?: string | null
          error_message?: string | null
          event_id: string
          evidence_payload?: Json | null
          expires_at?: string | null
          external_assignment_id?: string | null
          external_document_id?: string | null
          external_request_id?: string | null
          id?: string
          internal_status?: string
          last_error?: string | null
          last_synced_at?: string | null
          original_file_hash?: string | null
          original_file_path?: string | null
          provider?: string
          provider_response?: Json | null
          provider_status?: string | null
          sent_at?: string | null
          signature_provider?: string | null
          signature_url?: string | null
          signed_at?: string | null
          signed_file_hash?: string | null
          signed_file_path?: string | null
          signer_document?: string | null
          signer_email?: string | null
          signer_name?: string | null
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          addendum_id?: string | null
          callback_payload?: Json | null
          cancelled_at?: string | null
          completed_at?: string | null
          contract_id?: string
          contract_version_id?: number | null
          created_at?: string
          dispatch_status?: string
          document_kind?: string
          error_code?: string | null
          error_message?: string | null
          event_id?: string
          evidence_payload?: Json | null
          expires_at?: string | null
          external_assignment_id?: string | null
          external_document_id?: string | null
          external_request_id?: string | null
          id?: string
          internal_status?: string
          last_error?: string | null
          last_synced_at?: string | null
          original_file_hash?: string | null
          original_file_path?: string | null
          provider?: string
          provider_response?: Json | null
          provider_status?: string | null
          sent_at?: string | null
          signature_provider?: string | null
          signature_url?: string | null
          signed_at?: string | null
          signed_file_hash?: string | null
          signed_file_path?: string | null
          signer_document?: string | null
          signer_email?: string | null
          signer_name?: string | null
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_signature_requests_addendum_id_fkey"
            columns: ["addendum_id"]
            isOneToOne: false
            referencedRelation: "contract_addendums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signature_requests_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "event_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signature_signers: {
        Row: {
          created_at: string
          email: string
          external_signer_id: string | null
          full_name: string
          id: string
          notification_status: string
          notified_at: string | null
          role: string
          signature_request_id: string
          signature_url: string | null
          signed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          external_signer_id?: string | null
          full_name: string
          id?: string
          notification_status?: string
          notified_at?: string | null
          role?: string
          signature_request_id: string
          signature_url?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          external_signer_id?: string | null
          full_name?: string
          id?: string
          notification_status?: string
          notified_at?: string | null
          role?: string
          signature_request_id?: string
          signature_url?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_signature_signers_signature_request_id_fkey"
            columns: ["signature_request_id"]
            isOneToOne: false
            referencedRelation: "contract_signature_requests"
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
      document_share_links: {
        Row: {
          bucket_id: string
          created_at: string
          created_by: string | null
          document_kind: string
          event_id: string | null
          expires_at: string
          filename: string | null
          id: string
          last_accessed_at: string | null
          mime_type: string
          object_path: string
          token_hash: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          created_by?: string | null
          document_kind: string
          event_id?: string | null
          expires_at: string
          filename?: string | null
          id?: string
          last_accessed_at?: string | null
          mime_type?: string
          object_path: string
          token_hash: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          created_by?: string | null
          document_kind?: string
          event_id?: string | null
          expires_at?: string
          filename?: string | null
          id?: string
          last_accessed_at?: string | null
          mime_type?: string
          object_path?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_share_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      drink_alias_history: {
        Row: {
          action: string
          alias: string
          alias_id: string | null
          business_unit: string | null
          changed_by: string | null
          created_at: string
          details: Json | null
          id: string
          new_drink_id: string
          normalized_alias: string
          old_drink_id: string | null
          performer_name: string | null
          source: string
        }
        Insert: {
          action: string
          alias: string
          alias_id?: string | null
          business_unit?: string | null
          changed_by?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          new_drink_id: string
          normalized_alias: string
          old_drink_id?: string | null
          performer_name?: string | null
          source?: string
        }
        Update: {
          action?: string
          alias?: string
          alias_id?: string | null
          business_unit?: string | null
          changed_by?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          new_drink_id?: string
          normalized_alias?: string
          old_drink_id?: string | null
          performer_name?: string | null
          source?: string
        }
        Relationships: []
      }
      drink_aliases: {
        Row: {
          active: boolean
          alias: string
          business_unit: string | null
          created_at: string
          created_by: string | null
          drink_id: string
          id: string
          normalized_alias: string
          source: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          alias: string
          business_unit?: string | null
          created_at?: string
          created_by?: string | null
          drink_id: string
          id?: string
          normalized_alias: string
          source?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          alias?: string
          business_unit?: string | null
          created_at?: string
          created_by?: string | null
          drink_id?: string
          id?: string
          normalized_alias?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drink_aliases_drink_id_fkey"
            columns: ["drink_id"]
            isOneToOne: false
            referencedRelation: "drinks"
            referencedColumns: ["id"]
          },
        ]
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
          show_in_public_menu: boolean
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
          show_in_public_menu?: boolean
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
          show_in_public_menu?: boolean
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
          beverages: Json
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
          event_snapshot: Json | null
          final_budget_value: number | null
          fuel_value: number | null
          guest_count: number | null
          has_shots: boolean
          has_travel: boolean | null
          has_welcome_drinks: boolean
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
          shots_items: Json
          shots_total_value: number
          status: string | null
          team_total_value: number | null
          updated_at: string | null
          version_number: number
          welcome_drinks_cost: number
          welcome_drinks_final_value: number
          welcome_drinks_per_person: number
          welcome_drinks_profit_percentage: number
          welcome_drinks_selected: Json
        }
        Insert: {
          average_drink_cost?: number | null
          average_value_per_person?: number | null
          bartender_quantity?: number | null
          bartender_unit_value?: number | null
          beverages?: Json
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
          event_snapshot?: Json | null
          final_budget_value?: number | null
          fuel_value?: number | null
          guest_count?: number | null
          has_shots?: boolean
          has_travel?: boolean | null
          has_welcome_drinks?: boolean
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
          shots_items?: Json
          shots_total_value?: number
          status?: string | null
          team_total_value?: number | null
          updated_at?: string | null
          version_number: number
          welcome_drinks_cost?: number
          welcome_drinks_final_value?: number
          welcome_drinks_per_person?: number
          welcome_drinks_profit_percentage?: number
          welcome_drinks_selected?: Json
        }
        Update: {
          average_drink_cost?: number | null
          average_value_per_person?: number | null
          bartender_quantity?: number | null
          bartender_unit_value?: number | null
          beverages?: Json
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
          event_snapshot?: Json | null
          final_budget_value?: number | null
          fuel_value?: number | null
          guest_count?: number | null
          has_shots?: boolean
          has_travel?: boolean | null
          has_welcome_drinks?: boolean
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
          shots_items?: Json
          shots_total_value?: number
          status?: string | null
          team_total_value?: number | null
          updated_at?: string | null
          version_number?: number
          welcome_drinks_cost?: number
          welcome_drinks_final_value?: number
          welcome_drinks_per_person?: number
          welcome_drinks_profit_percentage?: number
          welcome_drinks_selected?: Json
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
      event_closing_items: {
        Row: {
          category: string
          consumed_cost: number | null
          created_at: string
          event_id: string
          id: string
          item_name: string
          lost_cost: number | null
          notes: string | null
          planning_item_id: string | null
          quantity_lost_or_broken: number
          quantity_returned: number
          quantity_taken: number
          quantity_used: number
          unit: string | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          category: string
          consumed_cost?: number | null
          created_at?: string
          event_id: string
          id?: string
          item_name: string
          lost_cost?: number | null
          notes?: string | null
          planning_item_id?: string | null
          quantity_lost_or_broken?: number
          quantity_returned?: number
          quantity_taken?: number
          quantity_used?: number
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          consumed_cost?: number | null
          created_at?: string
          event_id?: string
          id?: string
          item_name?: string
          lost_cost?: number | null
          notes?: string | null
          planning_item_id?: string | null
          quantity_lost_or_broken?: number
          quantity_returned?: number
          quantity_taken?: number
          quantity_used?: number
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_closing_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_closing_items_planning_item_id_fkey"
            columns: ["planning_item_id"]
            isOneToOne: false
            referencedRelation: "event_planning_items"
            referencedColumns: ["id"]
          },
        ]
      }
      event_closings: {
        Row: {
          closing_date: string | null
          created_at: string
          created_by: string | null
          event_id: string
          event_margin: number | null
          event_profit: number | null
          general_notes: string | null
          id: string
          improvement_points: string | null
          revenue_amount: number | null
          status: string
          total_consumed_cost: number | null
          total_event_cost: number | null
          total_logistics_cost: number | null
          total_lost_cost: number | null
          total_purchase_cost: number | null
          total_team_cost: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          closing_date?: string | null
          created_at?: string
          created_by?: string | null
          event_id: string
          event_margin?: number | null
          event_profit?: number | null
          general_notes?: string | null
          id?: string
          improvement_points?: string | null
          revenue_amount?: number | null
          status?: string
          total_consumed_cost?: number | null
          total_event_cost?: number | null
          total_logistics_cost?: number | null
          total_lost_cost?: number | null
          total_purchase_cost?: number | null
          total_team_cost?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          closing_date?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string
          event_margin?: number | null
          event_profit?: number | null
          general_notes?: string | null
          id?: string
          improvement_points?: string | null
          revenue_amount?: number | null
          status?: string
          total_consumed_cost?: number | null
          total_event_cost?: number | null
          total_logistics_cost?: number | null
          total_lost_cost?: number | null
          total_purchase_cost?: number | null
          total_team_cost?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_closings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
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
          budget_version_id: string | null
          created_at: string | null
          event_id: string
          external_id: string | null
          fully_signed_at: string | null
          generated_at: string | null
          generated_file_path: string | null
          generated_file_url: string | null
          id: string
          legal_snapshot: Json | null
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
          budget_version_id?: string | null
          created_at?: string | null
          event_id: string
          external_id?: string | null
          fully_signed_at?: string | null
          generated_at?: string | null
          generated_file_path?: string | null
          generated_file_url?: string | null
          id?: string
          legal_snapshot?: Json | null
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
          budget_version_id?: string | null
          created_at?: string | null
          event_id?: string
          external_id?: string | null
          fully_signed_at?: string | null
          generated_at?: string | null
          generated_file_path?: string | null
          generated_file_url?: string | null
          id?: string
          legal_snapshot?: Json | null
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
            foreignKeyName: "event_contracts_budget_version_id_fkey"
            columns: ["budget_version_id"]
            isOneToOne: false
            referencedRelation: "event_budget_versions"
            referencedColumns: ["id"]
          },
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
      event_menu_settings: {
        Row: {
          artwork_mode: string
          artwork_url: string | null
          created_at: string
          custom_label: string | null
          event_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          artwork_mode?: string
          artwork_url?: string | null
          created_at?: string
          custom_label?: string | null
          event_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          artwork_mode?: string
          artwork_url?: string | null
          created_at?: string
          custom_label?: string | null
          event_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_menu_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
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
      event_planning_items: {
        Row: {
          category: string
          created_at: string
          estimated_total_cost: number | null
          estimated_unit_cost: number | null
          event_id: string
          id: string
          inventory_id: string | null
          item_name: string
          notes: string | null
          origin: string | null
          planned_quantity: number
          source_expense_item_id: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          estimated_total_cost?: number | null
          estimated_unit_cost?: number | null
          event_id: string
          id?: string
          inventory_id?: string | null
          item_name: string
          notes?: string | null
          origin?: string | null
          planned_quantity?: number
          source_expense_item_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          estimated_total_cost?: number | null
          estimated_unit_cost?: number | null
          event_id?: string
          id?: string
          inventory_id?: string | null
          item_name?: string
          notes?: string | null
          origin?: string | null
          planned_quantity?: number
          source_expense_item_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_planning_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_planning_items_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_planning_items_source_expense_item_id_fkey"
            columns: ["source_expense_item_id"]
            isOneToOne: false
            referencedRelation: "financial_expense_items"
            referencedColumns: ["id"]
          },
        ]
      }
      event_requested_drinks: {
        Row: {
          created_at: string
          drink_id: string
          event_id: string
        }
        Insert: {
          created_at?: string
          drink_id: string
          event_id: string
        }
        Update: {
          created_at?: string
          drink_id?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_requested_drinks_drink_id_fkey"
            columns: ["drink_id"]
            isOneToOne: false
            referencedRelation: "drinks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_requested_drinks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tasting_drinks: {
        Row: {
          bride_drink: boolean
          created_at: string
          display_order: number
          drink_description: string | null
          drink_id: string
          drink_image: string | null
          drink_name: string
          groom_drink: boolean
          id: string
          selected_for_event: boolean
          tasting_id: string
        }
        Insert: {
          bride_drink?: boolean
          created_at?: string
          display_order?: number
          drink_description?: string | null
          drink_id: string
          drink_image?: string | null
          drink_name: string
          groom_drink?: boolean
          id?: string
          selected_for_event?: boolean
          tasting_id: string
        }
        Update: {
          bride_drink?: boolean
          created_at?: string
          display_order?: number
          drink_description?: string | null
          drink_id?: string
          drink_image?: string | null
          drink_name?: string
          groom_drink?: boolean
          id?: string
          selected_for_event?: boolean
          tasting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_tasting_drinks_drink_id_fkey"
            columns: ["drink_id"]
            isOneToOne: false
            referencedRelation: "drinks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tasting_drinks_tasting_id_fkey"
            columns: ["tasting_id"]
            isOneToOne: false
            referencedRelation: "event_tastings"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tasting_participants: {
        Row: {
          created_at: string
          id: string
          name: string | null
          slot: number
          tasting_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          slot: number
          tasting_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          slot?: number
          tasting_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_tasting_participants_tasting_id_fkey"
            columns: ["tasting_id"]
            isOneToOne: false
            referencedRelation: "event_tastings"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tasting_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          participant_id: string
          score: number
          tasting_drink_id: string
          tasting_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          participant_id: string
          score: number
          tasting_drink_id: string
          tasting_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          participant_id?: string
          score?: number
          tasting_drink_id?: string
          tasting_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_tasting_ratings_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "event_tasting_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tasting_ratings_tasting_drink_id_fkey"
            columns: ["tasting_drink_id"]
            isOneToOne: false
            referencedRelation: "event_tasting_drinks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tasting_ratings_tasting_id_fkey"
            columns: ["tasting_id"]
            isOneToOne: false
            referencedRelation: "event_tastings"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tastings: {
        Row: {
          created_at: string
          duration_minutes: number
          event_id: string
          google_calendar_event_id: string | null
          google_calendar_html_link: string | null
          google_calendar_sync_error: string | null
          google_calendar_sync_status: string
          google_calendar_synced_at: string | null
          guest_observations: string | null
          id: string
          location: string
          notes: string | null
          public_enabled: boolean
          public_token: string
          scheduled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          event_id: string
          google_calendar_event_id?: string | null
          google_calendar_html_link?: string | null
          google_calendar_sync_error?: string | null
          google_calendar_sync_status?: string
          google_calendar_synced_at?: string | null
          guest_observations?: string | null
          id?: string
          location?: string
          notes?: string | null
          public_enabled?: boolean
          public_token?: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          event_id?: string
          google_calendar_event_id?: string | null
          google_calendar_html_link?: string | null
          google_calendar_sync_error?: string | null
          google_calendar_sync_status?: string
          google_calendar_synced_at?: string | null
          guest_observations?: string | null
          id?: string
          location?: string
          notes?: string | null
          public_enabled?: boolean
          public_token?: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_tastings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          bride_name: string | null
          city: string | null
          client_name: string
          created_at: string | null
          current_budget_value: number | null
          current_profit_value: number | null
          date: string
          drinks: string[] | null
          duration_hours: number | null
          email: string | null
          event_location: string | null
          event_name: string | null
          event_time: string | null
          event_type: string
          google_calendar_event_id: string | null
          google_calendar_html_link: string | null
          google_calendar_sync_error: string | null
          google_calendar_sync_status: string
          google_calendar_synced_at: string | null
          groom_name: string | null
          guests: number
          id: string
          is_paid_full: boolean
          lead_source: string | null
          notes: string | null
          origin: string
          paid_amount_received: number | null
          payment_due_date: string | null
          payment_percent_received: number | null
          phone: string | null
          public_request_session_id: string | null
          referral_name: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          bride_name?: string | null
          city?: string | null
          client_name: string
          created_at?: string | null
          current_budget_value?: number | null
          current_profit_value?: number | null
          date: string
          drinks?: string[] | null
          duration_hours?: number | null
          email?: string | null
          event_location?: string | null
          event_name?: string | null
          event_time?: string | null
          event_type: string
          google_calendar_event_id?: string | null
          google_calendar_html_link?: string | null
          google_calendar_sync_error?: string | null
          google_calendar_sync_status?: string
          google_calendar_synced_at?: string | null
          groom_name?: string | null
          guests?: number
          id?: string
          is_paid_full?: boolean
          lead_source?: string | null
          notes?: string | null
          origin?: string
          paid_amount_received?: number | null
          payment_due_date?: string | null
          payment_percent_received?: number | null
          phone?: string | null
          public_request_session_id?: string | null
          referral_name?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          bride_name?: string | null
          city?: string | null
          client_name?: string
          created_at?: string | null
          current_budget_value?: number | null
          current_profit_value?: number | null
          date?: string
          drinks?: string[] | null
          duration_hours?: number | null
          email?: string | null
          event_location?: string | null
          event_name?: string | null
          event_time?: string | null
          event_type?: string
          google_calendar_event_id?: string | null
          google_calendar_html_link?: string | null
          google_calendar_sync_error?: string | null
          google_calendar_sync_status?: string
          google_calendar_synced_at?: string | null
          groom_name?: string | null
          guests?: number
          id?: string
          is_paid_full?: boolean
          lead_source?: string | null
          notes?: string | null
          origin?: string
          paid_amount_received?: number | null
          payment_due_date?: string | null
          payment_percent_received?: number | null
          phone?: string | null
          public_request_session_id?: string | null
          referral_name?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      financial_expense_items: {
        Row: {
          allocated_quantity: number
          created_at: string
          expense_id: string
          id: string
          inventory_id: string | null
          product_name: string
          quantity: number
          returned_quantity: number
          reviewed: boolean
          suggested_category: string | null
          total_price: number | null
          unit: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          allocated_quantity?: number
          created_at?: string
          expense_id: string
          id?: string
          inventory_id?: string | null
          product_name: string
          quantity?: number
          returned_quantity?: number
          reviewed?: boolean
          suggested_category?: string | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          allocated_quantity?: number
          created_at?: string
          expense_id?: string
          id?: string
          inventory_id?: string | null
          product_name?: string
          quantity?: number
          returned_quantity?: number
          reviewed?: boolean
          suggested_category?: string | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_expense_items_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "financial_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_expense_items_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
        ]
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
          cash_effect: boolean
          category: string
          classification: string
          cost_center: string | null
          created_at: string | null
          created_by_user_id: string | null
          date: string
          description: string
          due_date: string | null
          entry_type: string
          event_id: string | null
          expense_type: string
          id: string
          inventory_transfer_id: string | null
          invoice_url: string | null
          manually_edited_fields: string[]
          modality: string
          ocr_metadata: Json
          ocr_raw_text: string | null
          payment_method: string
          payment_payer_name: string | null
          payment_source: string | null
          receipt_url: string | null
          responsible: string
          review_status: string
          source_channel: string
          source_reference: string | null
          staff_name: string | null
          staff_role: string | null
          status: string
          supplier_cnpj: string | null
          supplier_name: string | null
          tasting_id: string | null
          updated_at: string | null
          updated_by_user_id: string | null
        }
        Insert: {
          amount?: number
          auto_filled_fields?: string[]
          cash_effect?: boolean
          category: string
          classification?: string
          cost_center?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          date: string
          description: string
          due_date?: string | null
          entry_type?: string
          event_id?: string | null
          expense_type?: string
          id?: string
          inventory_transfer_id?: string | null
          invoice_url?: string | null
          manually_edited_fields?: string[]
          modality: string
          ocr_metadata?: Json
          ocr_raw_text?: string | null
          payment_method: string
          payment_payer_name?: string | null
          payment_source?: string | null
          receipt_url?: string | null
          responsible: string
          review_status?: string
          source_channel?: string
          source_reference?: string | null
          staff_name?: string | null
          staff_role?: string | null
          status?: string
          supplier_cnpj?: string | null
          supplier_name?: string | null
          tasting_id?: string | null
          updated_at?: string | null
          updated_by_user_id?: string | null
        }
        Update: {
          amount?: number
          auto_filled_fields?: string[]
          cash_effect?: boolean
          category?: string
          classification?: string
          cost_center?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          date?: string
          description?: string
          due_date?: string | null
          entry_type?: string
          event_id?: string | null
          expense_type?: string
          id?: string
          inventory_transfer_id?: string | null
          invoice_url?: string | null
          manually_edited_fields?: string[]
          modality?: string
          ocr_metadata?: Json
          ocr_raw_text?: string | null
          payment_method?: string
          payment_payer_name?: string | null
          payment_source?: string | null
          receipt_url?: string | null
          responsible?: string
          review_status?: string
          source_channel?: string
          source_reference?: string | null
          staff_name?: string | null
          staff_role?: string | null
          status?: string
          supplier_cnpj?: string | null
          supplier_name?: string | null
          tasting_id?: string | null
          updated_at?: string | null
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_expenses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_expenses_tasting_id_fkey"
            columns: ["tasting_id"]
            isOneToOne: false
            referencedRelation: "event_tastings"
            referencedColumns: ["id"]
          },
        ]
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
          canva_design_id: string | null
          created_at: string | null
          event_id: string
          final_pdf_url: string | null
          generated_at: string | null
          id: string
          proposal_data: Json
          status: string
          storage_path: string | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          budget_id?: string | null
          canva_design_id?: string | null
          created_at?: string | null
          event_id: string
          final_pdf_url?: string | null
          generated_at?: string | null
          id?: string
          proposal_data?: Json
          status?: string
          storage_path?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          budget_id?: string | null
          canva_design_id?: string | null
          created_at?: string | null
          event_id?: string
          final_pdf_url?: string | null
          generated_at?: string | null
          id?: string
          proposal_data?: Json
          status?: string
          storage_path?: string | null
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
      goatbar_user_profiles: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      google_calendar_integrations: {
        Row: {
          access_token: string
          calendar_id: string
          calendar_name: string
          created_at: string
          google_account_avatar: string | null
          google_account_email: string
          google_account_name: string | null
          id: string
          last_sync_at: string | null
          last_sync_error: string | null
          refresh_token: string | null
          scope: string | null
          status: string
          token_expires_at: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_token: string
          calendar_id?: string
          calendar_name?: string
          created_at?: string
          google_account_avatar?: string | null
          google_account_email: string
          google_account_name?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          refresh_token?: string | null
          scope?: string | null
          status?: string
          token_expires_at: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_token?: string
          calendar_id?: string
          calendar_name?: string
          created_at?: string
          google_account_avatar?: string | null
          google_account_email?: string
          google_account_name?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          refresh_token?: string | null
          scope?: string | null
          status?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      google_calendar_oauth_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          state: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          state: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          state?: string
          user_id?: string | null
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
          destination_modality: string | null
          event_id: string | null
          financial_entry_id: string | null
          id: string
          inventory_id: string
          notes: string | null
          performed_by_user_id: string | null
          quantity: number
          source: string
          source_expense_item_id: string | null
          tasting_id: string | null
          total_cost: number | null
          type: string
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          destination_modality?: string | null
          event_id?: string | null
          financial_entry_id?: string | null
          id?: string
          inventory_id: string
          notes?: string | null
          performed_by_user_id?: string | null
          quantity: number
          source: string
          source_expense_item_id?: string | null
          tasting_id?: string | null
          total_cost?: number | null
          type: string
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          destination_modality?: string | null
          event_id?: string | null
          financial_entry_id?: string | null
          id?: string
          inventory_id?: string
          notes?: string | null
          performed_by_user_id?: string | null
          quantity?: number
          source?: string
          source_expense_item_id?: string | null
          tasting_id?: string | null
          total_cost?: number | null
          type?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_source_expense_item_id_fkey"
            columns: ["source_expense_item_id"]
            isOneToOne: false
            referencedRelation: "financial_expense_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_tasting_id_fkey"
            columns: ["tasting_id"]
            isOneToOne: false
            referencedRelation: "event_tastings"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_funnel_events: {
        Row: {
          created_at: string
          event_id: string | null
          event_key: string
          event_name: string
          id: string
          journey_id: string
          lead_id: string | null
          metadata: Json
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          event_key: string
          event_name: string
          id?: string
          journey_id: string
          lead_id?: string | null
          metadata?: Json
        }
        Update: {
          created_at?: string
          event_id?: string | null
          event_key?: string
          event_name?: string
          id?: string
          journey_id?: string
          lead_id?: string | null
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lead_funnel_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_funnel_events_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "lead_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_funnel_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_funnel_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_with_effective_stage"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_journeys: {
        Row: {
          created_at: string
          id: string
          landing_page: string | null
          last_activity_at: string
          lead_id: string | null
          referrer: string | null
          session_id: string
          source: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          landing_page?: string | null
          last_activity_at?: string
          lead_id?: string | null
          referrer?: string | null
          session_id: string
          source?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          landing_page?: string | null
          last_activity_at?: string
          lead_id?: string | null
          referrer?: string | null
          session_id?: string
          source?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_journeys_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_journeys_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_with_effective_stage"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string
          email: string | null
          event_date: string | null
          event_id: string | null
          event_type: string | null
          guest_count: number | null
          id: string
          last_activity_at: string
          name: string
          source: string | null
          stage: string
          whatsapp: string
          whatsapp_normalized: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_date?: string | null
          event_id?: string | null
          event_type?: string | null
          guest_count?: number | null
          id?: string
          last_activity_at?: string
          name: string
          source?: string | null
          stage?: string
          whatsapp: string
          whatsapp_normalized: string
        }
        Update: {
          created_at?: string
          email?: string | null
          event_date?: string | null
          event_id?: string | null
          event_type?: string | null
          guest_count?: number | null
          id?: string
          last_activity_at?: string
          name?: string
          source?: string | null
          stage?: string
          whatsapp?: string
          whatsapp_normalized?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
      proposal_template_field_mappings: {
        Row: {
          canva_field_key: string
          canva_field_type: string
          created_at: string | null
          formatter: string
          id: string
          required: boolean
          source_field_key: string | null
          source_type: string
          static_value: string | null
          template_id: string
          updated_at: string | null
        }
        Insert: {
          canva_field_key: string
          canva_field_type?: string
          created_at?: string | null
          formatter?: string
          id?: string
          required?: boolean
          source_field_key?: string | null
          source_type?: string
          static_value?: string | null
          template_id: string
          updated_at?: string | null
        }
        Update: {
          canva_field_key?: string
          canva_field_type?: string
          created_at?: string | null
          formatter?: string
          id?: string
          required?: boolean
          source_field_key?: string | null
          source_type?: string
          static_value?: string | null
          template_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_template_field_mappings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "proposal_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_template_fields: {
        Row: {
          alignment: string
          arc_angle: number | null
          arc_radius: number | null
          auto_resize: boolean
          color_hex: string
          config: Json
          created_at: string
          field_key: string | null
          field_label: string | null
          field_type: string
          font_color: string | null
          font_family: string
          font_size: number
          font_weight: string
          height: number
          id: string
          image_fit: string | null
          label: string
          letter_spacing: number
          line_height: number
          overflow_control: string
          page: number
          page_number: number | null
          position_x: number
          position_y: number
          technical_name: string
          template_id: string
          text_align: string | null
          updated_at: string
          width: number
          x: number | null
          y: number | null
          z_index: number
        }
        Insert: {
          alignment?: string
          arc_angle?: number | null
          arc_radius?: number | null
          auto_resize?: boolean
          color_hex?: string
          config?: Json
          created_at?: string
          field_key?: string | null
          field_label?: string | null
          field_type: string
          font_color?: string | null
          font_family?: string
          font_size?: number
          font_weight?: string
          height: number
          id?: string
          image_fit?: string | null
          label: string
          letter_spacing?: number
          line_height?: number
          overflow_control?: string
          page?: number
          page_number?: number | null
          position_x: number
          position_y: number
          technical_name: string
          template_id: string
          text_align?: string | null
          updated_at?: string
          width: number
          x?: number | null
          y?: number | null
          z_index?: number
        }
        Update: {
          alignment?: string
          arc_angle?: number | null
          arc_radius?: number | null
          auto_resize?: boolean
          color_hex?: string
          config?: Json
          created_at?: string
          field_key?: string | null
          field_label?: string | null
          field_type?: string
          font_color?: string | null
          font_family?: string
          font_size?: number
          font_weight?: string
          height?: number
          id?: string
          image_fit?: string | null
          label?: string
          letter_spacing?: number
          line_height?: number
          overflow_control?: string
          page?: number
          page_number?: number | null
          position_x?: number
          position_y?: number
          technical_name?: string
          template_id?: string
          text_align?: string | null
          updated_at?: string
          width?: number
          x?: number | null
          y?: number | null
          z_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_template_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "proposal_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_templates: {
        Row: {
          canva_brand_template_id: string | null
          canva_brand_template_thumbnail_url: string | null
          canva_brand_template_title: string | null
          canva_last_synced_at: string | null
          created_at: string | null
          event_type: string
          file_url: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          provider: string
          updated_at: string | null
        }
        Insert: {
          canva_brand_template_id?: string | null
          canva_brand_template_thumbnail_url?: string | null
          canva_brand_template_title?: string | null
          canva_last_synced_at?: string | null
          created_at?: string | null
          event_type: string
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          provider?: string
          updated_at?: string | null
        }
        Update: {
          canva_brand_template_id?: string | null
          canva_brand_template_thumbnail_url?: string | null
          canva_brand_template_title?: string | null
          canva_last_synced_at?: string | null
          created_at?: string | null
          event_type?: string
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          provider?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          enabled: boolean
          endpoint: string
          id: string
          last_error: string | null
          last_success_at: string | null
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          enabled?: boolean
          endpoint: string
          id?: string
          last_error?: string | null
          last_success_at?: string | null
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          enabled?: boolean
          endpoint?: string
          id?: string
          last_error?: string | null
          last_success_at?: string | null
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
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
      user_messaging_accounts: {
        Row: {
          created_at: string
          display_name: string | null
          external_user_id: string | null
          id: string
          phone_number: string
          provider: string
          receive_new_budget_notifications: boolean
          updated_at: string
          user_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          external_user_id?: string | null
          id?: string
          phone_number: string
          provider?: string
          receive_new_budget_notifications?: boolean
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string | null
          external_user_id?: string | null
          id?: string
          phone_number?: string
          provider?: string
          receive_new_budget_notifications?: boolean
          updated_at?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      leads_with_effective_stage: {
        Row: {
          created_at: string | null
          effective_stage: string | null
          email: string | null
          event_date: string | null
          event_id: string | null
          event_type: string | null
          guest_count: number | null
          id: string | null
          last_activity_at: string | null
          name: string | null
          source: string | null
          stage: string | null
          whatsapp: string | null
          whatsapp_normalized: string | null
        }
        Insert: {
          created_at?: string | null
          effective_stage?: never
          email?: string | null
          event_date?: string | null
          event_id?: string | null
          event_type?: string | null
          guest_count?: number | null
          id?: string | null
          last_activity_at?: string | null
          name?: string | null
          source?: string | null
          stage?: string | null
          whatsapp?: string | null
          whatsapp_normalized?: string | null
        }
        Update: {
          created_at?: string | null
          effective_stage?: never
          email?: string | null
          event_date?: string | null
          event_id?: string | null
          event_type?: string | null
          guest_count?: number | null
          id?: string | null
          last_activity_at?: string | null
          name?: string | null
          source?: string | null
          stage?: string | null
          whatsapp?: string | null
          whatsapp_normalized?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      allocate_inventory_cost: {
        Args: {
          p_destination_modality: string
          p_event_id?: string
          p_inventory_id: string
          p_notes?: string
          p_performed_by_user_id?: string
          p_quantity: number
          p_tasting_id?: string
        }
        Returns: string
      }
      approve_goat_ai_inbox_item: {
        Args: {
          p_event_id?: string
          p_item_id: string
          p_override_data?: Json
          p_performed_by?: string
          p_performer_name?: string
        }
        Returns: Json
      }
      canva_rotate_tokens: {
        Args: {
          p_expected_refresh_token: string
          p_new_access_token: string
          p_new_expires_at: string
          p_new_refresh_token: string
          p_user_id: string
        }
        Returns: boolean
      }
      claim_budget_request_notification: {
        Args: { p_event_id: string; p_retry?: boolean }
        Returns: {
          created_at: string
          error: string | null
          error_category: string | null
          event_id: string
          id: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "budget_request_notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consume_budget_request_link:
        | {
            Args: {
              p_city: string
              p_client_name: string
              p_date: string
              p_email: string
              p_event_location: string
              p_event_name: string
              p_event_time: string
              p_event_type: string
              p_guests: number
              p_lead_source: string
              p_notes: string
              p_phone: string
              p_referral_name: string
              p_token: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_bride_name: string
              p_city: string
              p_client_name: string
              p_date: string
              p_duration_hours: number
              p_email: string
              p_event_location: string
              p_event_name: string
              p_event_time: string
              p_event_type: string
              p_groom_name: string
              p_guests: number
              p_lead_source: string
              p_notes: string
              p_phone: string
              p_referral_name: string
              p_requested_drink_ids: string[]
              p_token: string
            }
            Returns: Json
          }
      delete_event: { Args: { p_event_id: string }; Returns: Json }
      delete_public_budget_request: {
        Args: { p_event_id: string }
        Returns: Json
      }
      get_web_push_runtime_config: {
        Args: never
        Returns: {
          vapid_private_key: string
          vapid_public_key: string
          webhook_secret: string
        }[]
      }
      process_assinafy_webhook_event: {
        Args: {
          p_event_type: string
          p_external_document_id: string
          p_external_event_id: string
          p_payload: Json
          p_request_id: string
        }
        Returns: Json
      }
      return_event_leftover_to_inventory: {
        Args: {
          p_notes?: string
          p_planning_item_id: string
          p_quantity: number
        }
        Returns: string
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
