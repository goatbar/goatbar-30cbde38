import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Send,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Bot,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import giaAvatar from "@/assets/gia-avatar.png";
import { ChatMessageContent } from "./ChatMessageContent";
import {
  goatAIChatService,
  ChatMessage,
  SendMessageResponse,
} from "@/services/goat-ai/goat-ai-chat-service";

interface GoatAIChatViewProps {
  conversationId?: string;
  onConversationCreated?: (newId: string) => void;
}

const QUICK_PROMPTS = [
  "Nos eventos de aproximadamente 100 pessoas, qual foi a média de gelo gasto?",
  "Quantos eventos temos confirmados para os próximos meses?",
  "Buscar detalhes e cardápio de drinks do próximo evento",
  "Resumo do faturamento e resultado da unidade Goat Botequim",
];

export const GoatAIChatView: React.FC<GoatAIChatViewProps> = ({
  conversationId: initialConversationId,
  onConversationCreated,
}) => {
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [operationalStatus, setOperationalStatus] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<any>(null);
  const [attachments, setAttachments] = useState<
    Array<{
      mimeType: string;
      dataBase64?: string;
      fileName?: string;
      previewUrl?: string;
    }>
  >([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setConversationId(initialConversationId);
  }, [initialConversationId]);

  useEffect(() => {
    if (conversationId) {
      loadConversationMessages(conversationId);
    }
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, operationalStatus]);

  const loadConversationMessages = async (id: string) => {
    try {
      const msgs = await goatAIChatService.listMessages(id);
      setMessages(msgs);
    } catch (err) {
      console.error("Erro ao carregar mensagens:", err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`Arquivo ${file.name} excede o limite de 10MB`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        const preview = file.type.startsWith("image/") ? (reader.result as string) : undefined;

        setAttachments((prev) => [
          ...prev,
          {
            mimeType: file.type || "application/octet-stream",
            dataBase64: base64,
            fileName: file.name,
            previewUrl: preview,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim() && attachments.length === 0) return;
    if (loading) return;

    const currentAttachments = [...attachments];
    setInputText("");
    setAttachments([]);

    // Optimistic user message
    const tempUserMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      conversation_id: conversationId || "new",
      role: "user",
      content: textToSend,
      message_type: currentAttachments.length > 0 ? "document" : "text",
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setLoading(true);
    setOperationalStatus("Consultando dados operacionais com a GIA...");

    try {
      const response: SendMessageResponse = await goatAIChatService.sendMessage({
        conversationId,
        message: textToSend,
        attachments: currentAttachments.map((a) => ({
          mimeType: a.mimeType,
          dataBase64: a.dataBase64,
          fileName: a.fileName,
        })),
      });

      if (!conversationId && response.conversationId) {
        setConversationId(response.conversationId);
        onConversationCreated?.(response.conversationId);
      }

      // Append assistant reply
      const assistantMsg: ChatMessage = {
        id: response.messageId,
        conversation_id: response.conversationId,
        role: "assistant",
        content: response.reply,
        message_type: "text",
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, assistantMsg]);

      if (response.pendingAction) {
        setPendingAction(response.pendingAction);
      } else {
        setPendingAction(null);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao comunicar com a GIA");
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          conversation_id: conversationId || "new",
          role: "assistant",
          content: "Não consegui processar sua solicitação agora. Por favor, tente novamente.",
          message_type: "text",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      setOperationalStatus(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[700px] bg-surface rounded-2xl border border-border/60 shadow-sm overflow-hidden">
      {/* Chat Header */}
      <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-surface/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full border border-primary/30 overflow-hidden bg-primary/10 flex items-center justify-center text-primary shadow-sm shrink-0">
            <img
              src={giaAvatar}
              alt="GIA Avatar"
              className="h-full w-full object-cover"
              onError={(e) => {
                // Fallback to icon if image fails
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <Sparkles className="h-5 w-5 hidden" />
          </div>
          <div>
            <h3 className="font-display font-black text-sm tracking-tight text-foreground flex items-center gap-2">
              GIA
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/15 text-primary border border-primary/20">
                Assistente Conectada
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Sua assistente operacional conectada a eventos, sessões e controladoria
            </p>
          </div>
        </div>

        {conversationId && (
          <button
            onClick={() => {
              setConversationId(undefined);
              setMessages([]);
              setPendingAction(null);
            }}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 hover:bg-surface-hover transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Nova Conversa
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-12">
            <div className="h-16 w-16 rounded-full border-2 border-primary/40 overflow-hidden bg-primary/10 flex items-center justify-center text-primary mb-4 shadow-md">
              <img
                src={giaAvatar}
                alt="GIA"
                className="h-full w-full object-cover"
              />
            </div>
            <h4 className="font-display font-bold text-lg text-foreground mb-2">
              Olá! Eu sou a GIA 👋
            </h4>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              Posso consultar informações do Goat Bar, analisar documentos, registrar operações e ajudar com eventos, vendas, compras, estoque e controladoria. Como posso ajudar?
            </p>

            <div className="w-full space-y-2">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-left mb-2">
                Sugestões de comandos:
              </p>
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(prompt)}
                  className="w-full text-left p-3 rounded-xl border border-border/60 hover:border-primary/40 bg-surface hover:bg-surface-hover text-xs font-medium text-foreground transition-all duration-200 shadow-xs hover:shadow-sm"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="h-8 w-8 rounded-full border border-primary/30 overflow-hidden bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5 shadow-xs">
                      <img
                        src={giaAvatar}
                        alt="GIA"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                      <Bot className="h-4 w-4 hidden" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                      isUser
                        ? "bg-primary text-primary-foreground font-medium rounded-tr-xs shadow-xs"
                        : "bg-surface-active/60 border border-border/60 text-foreground rounded-tl-xs shadow-xs"
                    }`}
                  >
                    <ChatMessageContent content={msg.content} isUser={isUser} />
                  </div>

                  {isUser && (
                    <div className="h-8 w-8 rounded-full bg-surface-active border border-border/60 flex items-center justify-center text-muted-foreground shrink-0 mt-0.5 shadow-xs">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Operational Status (Thinking/Querying) */}
            {loading && operationalStatus && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-8 w-8 rounded-full border border-primary/30 overflow-hidden bg-primary/10 flex items-center justify-center text-primary shrink-0 animate-pulse shadow-xs">
                  <img
                    src={giaAvatar}
                    alt="GIA"
                    className="h-full w-full object-cover opacity-80"
                  />
                </div>
                <div className="bg-surface-active/40 border border-border/40 px-3.5 py-2 rounded-xl italic flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>{operationalStatus}</span>
                </div>
              </div>
            )}

            {/* Pending Action Confirmation Widget */}
            {pendingAction && pendingAction.status === "ready_for_confirmation" && (
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between gap-4 my-2">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-foreground">
                    Ação pronta para gravação. Confirma o lançamento?
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSendMessage("sim")}
                    className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer"
                  >
                    Sim, confirmar
                  </button>
                  <button
                    onClick={() => handleSendMessage("não")}
                    className="px-3 py-1.5 rounded-lg border border-border/60 text-xs font-medium text-muted-foreground hover:bg-surface transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="px-6 py-2 border-t border-border/40 bg-surface/30 flex gap-2 overflow-x-auto">
          {attachments.map((att, i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-surface-active border border-border/60 px-3 py-1.5 rounded-lg text-xs"
            >
              {att.previewUrl ? (
                <img src={att.previewUrl} alt="Preview" className="h-5 w-5 object-cover rounded" />
              ) : (
                <FileText className="h-4 w-4 text-primary" />
              )}
              <span className="max-w-[120px] truncate text-[11px] font-medium text-foreground">
                {att.fileName || "Documento"}
              </span>
              <button
                onClick={() => removeAttachment(i)}
                className="text-muted-foreground hover:text-destructive transition-colors ml-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Form */}
      <div className="p-4 border-t border-border/60 bg-surface/80 backdrop-blur-sm">
        <div className="relative flex items-end gap-2 bg-surface-active/50 border border-border/60 rounded-xl p-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            accept="image/*,.pdf,.doc,.docx"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-surface rounded-lg transition-colors shrink-0"
            title="Anexar comprovante ou documento"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem ou comando para a GIA..."
            rows={1}
            className="flex-1 bg-transparent border-0 resize-none text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden py-2 min-h-[36px] max-h-[120px]"
          />

          <button
            type="button"
            disabled={(!inputText.trim() && attachments.length === 0) || loading}
            onClick={() => handleSendMessage()}
            className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0 cursor-pointer shadow-xs"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/70 text-center mt-2">
          GIA Goat Bar • Model gemini-3.6-flash • Conectada ao banco operacional
        </p>
      </div>
    </div>
  );
};
