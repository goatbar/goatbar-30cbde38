import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  GoatAIMessageType,
  GoatAISource,
  GoatAIProcessingStatus,
  GoatAIApprovalStatus,
} from "./types.ts";
import { GeminiProvider } from "./gemini-provider.ts";
import { validateStructuredData } from "./schemas.ts";
import { DatabaseEvent, matchEventDeterministically } from "./event-matcher.ts";

export interface ProcessPipelineInput {
  existingItemId?: string;
  source: GoatAISource;
  source_message_id?: string | null;
  source_conversation_id?: string | null;
  source_sender_id?: string | null;
  source_sender_name?: string | null;
  message_type?: GoatAIMessageType;
  raw_text?: string | null;
  transcribed_text?: string | null;
  performed_by?: string | null;
}

export async function runGoatAIPipeline(
  adminClient: SupabaseClient,
  input: ProcessPipelineInput
) {
  const effectiveText = input.transcribed_text || input.raw_text || "";
  const provider = new GeminiProvider();

  // 1. Run AI interpretation
  const aiOutput = await provider.process({
    text: effectiveText,
    senderName: input.source_sender_name || undefined,
    messageType: input.message_type || "text",
  });

  // 2. Validate structured schema
  const validation = validateStructuredData(aiOutput.classification, aiOutput.data);
  const structuredData = validation.data;
  const warnings = [...aiOutput.warnings];
  if (!validation.isValid && validation.error) {
    warnings.push(`Validação de schema com avisos: ${validation.error}`);
  }

  // 3. Deterministic Event Matching
  let matchedEventId: string | null = null;
  let eventMatchConfidence = 0;
  let matchReason = "";

  try {
    const { data: events } = await adminClient
      .from("events")
      .select("id, client_name, groom_name, bride_name, event_name, date, event_location, city")
      .order("date", { ascending: false })
      .limit(100);

    if (events && events.length > 0) {
      const matchResult = matchEventDeterministically(
        events as DatabaseEvent[],
        aiOutput.event_reference,
        effectiveText
      );
      matchedEventId = matchResult.event_id;
      eventMatchConfidence = matchResult.confidence;
      matchReason = matchResult.reason;
    }
  } catch (err: any) {
    warnings.push(`Erro ao consultar eventos para correspondência: ${err?.message || "erro"}`);
  }

  // 4. Determine Approval Requirements
  const requiresApproval = [
    "event_purchase",
    "invoice",
    "receipt",
    "expense",
    "stock_movement",
  ].includes(aiOutput.classification);

  let processingStatus: GoatAIProcessingStatus = "processed";
  let approvalStatus: GoatAIApprovalStatus = requiresApproval ? "pending" : "not_required";

  if (aiOutput.provider_metadata.processing_mode === "unavailable") {
    processingStatus = "needs_review";
  } else if (!validation.isValid || aiOutput.classification === "unknown") {
    processingStatus = "needs_review";
  }

  // 5. Persist to ai_inbox_items
  const recordPayload = {
    source: input.source,
    source_message_id: input.source_message_id || null,
    source_conversation_id: input.source_conversation_id || null,
    source_sender_id: input.source_sender_id || null,
    source_sender_name: input.source_sender_name || null,
    message_type: input.message_type || "text",
    raw_text: input.raw_text || null,
    transcribed_text: input.transcribed_text || null,
    classification: aiOutput.classification,
    classification_confidence: aiOutput.classification_confidence,
    extraction_confidence: aiOutput.extraction_confidence,
    event_match_confidence: eventMatchConfidence,
    processing_status: processingStatus,
    processing_mode: aiOutput.provider_metadata.processing_mode,
    approval_status: approvalStatus,
    structured_data: structuredData,
    provider_metadata: {
      ...aiOutput.provider_metadata,
      event_match_reason: matchReason,
      warnings,
    },
    matched_event_id: matchedEventId,
    error_message: warnings.length > 0 ? warnings.join("; ") : null,
    processed_at: new Date().toISOString(),
  };

  let savedItem: any;

  if (input.existingItemId) {
    const { data, error } = await adminClient
      .from("ai_inbox_items")
      .update(recordPayload)
      .eq("id", input.existingItemId)
      .select()
      .single();
    if (error) throw error;
    savedItem = data;
  } else {
    const { data, error } = await adminClient
      .from("ai_inbox_items")
      .insert(recordPayload)
      .select()
      .single();
    if (error) throw error;
    savedItem = data;
  }

  // 6. Record Audit Log
  await adminClient.from("ai_action_logs").insert({
    ai_inbox_item_id: savedItem.id,
    action: input.existingItemId ? "reprocess_item" : "process_item",
    event_id: matchedEventId,
    performed_by: input.performed_by || null,
    performer_name: input.source_sender_name || "Goat AI Pipeline",
    automatic: !input.performed_by,
    previous_data: null,
    new_data: {
      classification: aiOutput.classification,
      processing_mode: aiOutput.provider_metadata.processing_mode,
      matched_event_id: matchedEventId,
    },
  });

  return savedItem;
}
