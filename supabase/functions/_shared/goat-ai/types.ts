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

export interface EventReference {
  name?: string | null;
  client_name?: string | null;
  groom_name?: string | null;
  bride_name?: string | null;
  event_name?: string | null;
  date?: string | null;
  event_date?: string | null;
  location?: string | null;
}

export interface EventMatchResult {
  event_id: string | null;
  confidence: number;
  reason: string;
  matched_event_name?: string;
}

export interface ProviderMetadata {
  provider: "gemini" | "heuristic" | "none";
  model?: string;
  processing_mode: GoatAIProcessingMode;
  prompt_version: string;
  processed_at: string;
  duration_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  event_match_reason?: string;
  warnings?: string[];
}

export interface AIInput {
  text: string;
  senderName?: string;
  messageType?: GoatAIMessageType;
  mediaUrl?: string;
}

export interface AIClassificationResult {
  classification: GoatAIClassification;
  confidence: number;
  reason?: string;
}

export interface AIExtractionResult {
  event_reference: EventReference;
  data: Record<string, unknown>;
  warnings: string[];
  missing_fields?: string[];
  extraction_confidence: number;
}

export interface AIProcessedOutput {
  classification: GoatAIClassification;
  classification_confidence: number;
  extraction_confidence: number;
  event_reference: EventReference;
  data: Record<string, unknown>;
  warnings: string[];
  missing_fields?: string[];
  provider_metadata: ProviderMetadata;
}

export interface AIProvider {
  classify(input: AIInput): Promise<AIClassificationResult>;
  extract(input: AIInput, classification?: GoatAIClassification): Promise<AIExtractionResult>;
  process(input: AIInput): Promise<AIProcessedOutput>;
}

export interface DocumentExtractor {
  extract(fileBytes: Uint8Array, mimeType: string): Promise<{ text: string; confidence: number; metadata: Record<string, unknown> }>;
}

export interface AudioTranscriber {
  transcribe(audioBytes: Uint8Array, mimeType: string): Promise<{ text: string; confidence: number }>;
}

export interface MessagingProvider {
  sendText(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
}
