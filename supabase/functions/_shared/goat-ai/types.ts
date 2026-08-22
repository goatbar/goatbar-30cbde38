export type ConversationChannel = "web" | "whatsapp" | "api";
export type MessageRole = "user" | "assistant" | "system" | "tool";
export type MessageType = "text" | "image" | "document" | "audio" | "action_prompt" | "action_result";
export type PendingActionStatus = "collecting" | "ready_for_confirmation" | "awaiting_confirmation" | "executing" | "executed" | "completed" | "cancelled" | "expired";
export type ToolCallStatus = "pending" | "running" | "success" | "error" | "rejected";

export interface AIConversation {
  id: string;
  user_id?: string | null;
  channel: ConversationChannel;
  external_conversation_id?: string | null;
  title: string;
  status: "active" | "archived" | "closed";
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  message_type: MessageType;
  attachment_url?: string | null;
  attachment_metadata?: Record<string, any>;
  external_message_id?: string | null;
  sender_name?: string | null;
  tokens_used?: number;
  created_at: string;
}

export interface AIPendingAction {
  id: string;
  conversation_id: string;
  tool_name: string;
  arguments: Record<string, any>;
  missing_fields: string[];
  summary?: string | null;
  status: PendingActionStatus;
  execution_id?: string | null;
  result?: any;
  error?: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface AIToolCall {
  id: string;
  conversation_id: string;
  message_id?: string | null;
  tool_name: string;
  arguments: Record<string, any>;
  result?: any;
  status: ToolCallStatus;
  error?: string | null;
  duration_ms?: number;
  performed_by?: string | null;
  started_at: string;
  finished_at?: string | null;
}

export interface UserMessagingAccount {
  id: string;
  user_id: string;
  provider: "whatsapp" | "telegram";
  external_user_id?: string | null;
  phone_number: string;
  display_name?: string | null;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface ToolContext {
  supabaseAdmin: any;
  userId?: string | null;
  userName?: string | null;
  userRole?: string | null;
  conversationId: string;
  channel: ConversationChannel;
  correlationId?: string;
  toolCallId?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  requires_confirmation?: boolean;
  missing_fields?: string[];
  summary?: string;
}

export interface GoatAIToolDefinition {
  name: string;
  domain?: "EVENTS" | "FINANCIAL" | "SALES" | "CONTROLLER" | "PURCHASES" | "ANALYTICS" | "OPERATIONS";
  sourceTable?: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  requiresConfirmation?: boolean;
  requiredPermission?: string;
  execute: (context: ToolContext, args: any) => Promise<ToolExecutionResult>;
}

export interface AgentAttachment {
  mimeType: string;
  dataBase64?: string;
  url?: string;
  fileName?: string;
}

export interface AgentInput {
  correlationId?: string;
  conversationId?: string;
  message: string;
  channel: ConversationChannel;
  userId?: string | null;
  userName?: string | null;
  userRole?: string | null;
  attachments?: AgentAttachment[];
  externalMessageId?: string | null;
  externalSenderId?: string | null;
  pageContext?: {
    currentEventId?: string;
    currentPage?: string;
  };
}

export interface AgentTurnResponse {
  conversationId: string;
  messageId: string;
  reply: string;
  statusUpdates?: string[];
  toolCallsExecuted: {
    toolName: string;
    arguments: any;
    result: any;
    status: ToolCallStatus;
  }[];
  pendingAction?: {
    id: string;
    toolName: string;
    status: PendingActionStatus;
    missingFields: string[];
    summary?: string | null;
  } | null;
  tokensUsed?: {
    input: number;
    output: number;
    total: number;
  };
}
