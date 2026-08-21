export type GoatAISource = "whatsapp" | "manual" | "api";

export type GoatAIMessageType = "text" | "image" | "audio" | "document" | "other";

export type GoatAIClassification =
  | "sales_session"
  | "operation_report"
  | "event_purchase"
  | "invoice"
  | "receipt"
  | "stock_movement"
  | "expense"
  | "event_note"
  | "general_note"
  | "unknown";

export type GoatAIProcessingStatus =
  | "received"
  | "processing"
  | "processed"
  | "needs_review"
  | "failed";

export type GoatAIProcessingMode = "gemini" | "heuristic" | "unavailable";

export type GoatAIApprovalStatus = "pending" | "approved" | "rejected" | "not_required";

export interface AIInboxItem {
  id: string;
  source: GoatAISource;
  source_message_id?: string | null;
  source_conversation_id?: string | null;
  source_sender_id?: string | null;
  source_sender_name?: string | null;
  message_type: GoatAIMessageType;
  raw_text?: string | null;
  transcribed_text?: string | null;
  classification: GoatAIClassification;
  classification_confidence: number;
  extraction_confidence: number;
  event_match_confidence: number;
  processing_status: GoatAIProcessingStatus;
  processing_mode: GoatAIProcessingMode;
  approval_status: GoatAIApprovalStatus;
  structured_data: Record<string, any>;
  provider_metadata: {
    provider?: "gemini" | "heuristic" | "none";
    model?: string;
    processing_mode?: GoatAIProcessingMode;
    prompt_version?: string;
    processed_at?: string;
    event_match_reason?: string;
    warnings?: string[];
  };
  matched_event_id?: string | null;
  matched_location_id?: string | null;
  matched_supplier_id?: string | null;
  applied_entity_type?: string | null;
  applied_entity_id?: string | null;
  applied_at?: string | null;
  error_message?: string | null;
  received_at: string;
  processed_at?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  events?: {
    id: string;
    client_name: string;
    event_name?: string | null;
    date: string;
    event_location?: string | null;
  } | null;
  attachments?: AIInboxAttachment[];
}

export interface AIActionLog {
  id: string;
  ai_inbox_item_id?: string | null;
  action: string;
  event_id?: string | null;
  performed_by?: string | null;
  performer_name?: string | null;
  automatic: boolean;
  previous_data?: Record<string, any> | null;
  new_data?: Record<string, any> | null;
  error_message?: string | null;
  created_at: string;
}

export interface AIInboxAttachment {
  id: string;
  ai_inbox_item_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  attachment_type: "image" | "audio" | "pdf" | "document" | "other";
  created_at: string;
}

export interface IntegrationStatus {
  gemini: {
    provider?: string;
    googleProject?: string;
    configured: boolean;
    model: string;
    heuristicFallbackAllowed: boolean;
  };
  whatsapp: {
    configured: boolean;
    hasVerifyToken: boolean;
    phoneNumberId?: string;
    businessAccountId?: string;
    appId?: string;
    displayPhoneNumber?: string;
    verifiedName?: string;
    webhookUrl: string;
    authorizedUsersCount?: number;
    lastMessageAt?: string | null;
  };
  timestamp: string;
}

export interface UserMessagingAccountItem {
  id: string;
  user_id: string;
  provider: "whatsapp" | "telegram";
  external_user_id?: string | null;
  phone_number: string;
  display_name?: string | null;
  verified: boolean;
  created_at: string;
  updated_at: string;
  profile?: {
    display_name?: string;
    email?: string;
  };
}
