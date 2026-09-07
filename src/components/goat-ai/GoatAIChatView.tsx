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

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleCheckTurnStatus = async (turnId: string) => {
    setLoading(true);
    setOperationalStatus("Consultando status do turno no servidor...");
    try {
      const reconciled = await goatAIChatService.reconcileTurn(turnId, conversationId);
      if (reconciled?.status === "completed" && reconciled.reply) {
        toast.success("Resposta recuperada do servidor!");
        setMessages((prev) =>
          prev.map((m) =>
            m.turn_id === turnId && m.role === "assistant"
              ? {
                  ...m,
                  content: reconciled.reply!,
                  turn_status: "completed",
                  is_error: false,
                }
              : m
          )
        );
      } else if (reconciled?.status === "partial" && reconciled.reply) {
        toast.warning("Resposta parcial recuperada!");
        setMessages((prev) =>
          prev.map((m) =>
            m.turn_id === turnId && m.role === "assistant"
              ? {
                  ...m,
                  content: reconciled.reply!,
                  turn_status: "partial",
                  is_error: false,
                }
              : m
          )
        );
      } else if (reconciled?.status === "processing") {
        toast.info("A GIA ainda está processando esse turno no servidor. Tente novamente em alguns segundos.");
      } else {
        toast.error("Turno não concluído no servidor. Tente reenviar a mensagem.");
      }
    } catch {
      toast.error("Erro ao verificar status do turno.");
    } finally {
      setLoading(false);
      setOperationalStatus(null);
    }
  };

  const handleSendMessage = async (customText?: string, retryUserContent?: string) => {
    const textToSend = customText || retryUserContent || inputText;
    if (!textToSend.trim() && attachments.length === 0) return;
    if (loading) return;

    const currentAttachments = [...attachments];
    if (!retryUserContent) {
      setInputText("");
      setAttachments([]);
    }

    const turnId = `turn_web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const requestId = `req_web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    console.log(`[GIA:UI] turn_started turnId=${turnId} reqId=${requestId} convId=${conversationId || "new"}`);

    // Optimistic user message
    const tempUserMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      conversation_id: conversationId || "new",
      role: "user",
      content: textToSend,
      message_type: currentAttachments.length > 0 ? "document" : "text",
      created_at: new Date().toISOString(),
      turn_id: turnId,
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setLoading(true);
    setOperationalStatus("Consultando dados operacionais com a GIA...");

    try {
      const response: SendMessageResponse = await goatAIChatService.sendMessage({
        conversationId,
        turnId,
        requestId,
        message: textToSend,
        attachments: currentAttachments.map((a) => ({
          mimeType: a.mimeType,
          dataBase64: a.dataBase64,
          fileName: a.fileName,
        })),
      });

      const effectiveConvId = response.conversationId || conversationId || "new";
      if (!conversationId && response.conversationId) {
        setConversationId(response.conversationId);
        onConversationCreated?.(response.conversationId);
      }

      const replyText = (response.reply || "").trim();
      const isEmptyReply = !replyText;

      console.log(`[GIA:UI] turn_completed turnId=${turnId} status=${response.turnStatus || "completed"} duration=${response.timings?.totalMs || 0}ms empty=${isEmptyReply}`);

      if (isEmptyReply) {
        // Prevent blank bubble rendering
        const assistantMsg: ChatMessage = {
          id: response.messageId || `err_${Date.now()}`,
          conversation_id: effectiveConvId,
          role: "assistant",
          content: "A GIA não retornou uma resposta válida neste momento. Por favor, tente novamente.",
          message_type: "text",
          created_at: new Date().toISOString(),
          turn_id: turnId,
          turn_status: "failed",
          is_error: true,
        };
        setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, assistantMsg]);
        return;
      }

      // Append assistant reply
      const assistantMsg: ChatMessage = {
        id: response.messageId,
        conversation_id: effectiveConvId,
        role: "assistant",
        content: response.reply,
        message_type: "text",
        created_at: new Date().toISOString(),
        turn_id: turnId,
        turn_status: response.turnStatus || "completed",
      };

      setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, assistantMsg]);

      if (response.pendingAction) {
        setPendingAction(response.pendingAction);
      } else {
        setPendingAction(null);
      }
    } catch (err: any) {
      console.warn(`[GIA:UI] transport_error turnId=${turnId} error=${err?.message}. Iniciando reconciliação...`);
      setOperationalStatus("Conexão interrompida. Verificando processamento da GIA no servidor...");

      // Directive 1: Reconcile turn by turnId after transport error
      let reconciled: any = null;
      const pollDelays = [2000, 3500, 5000, 7000];

      for (let attempt = 0; attempt < pollDelays.length; attempt++) {
        setOperationalStatus(`A GIA ainda está processando seus dados no servidor... (tentativa ${attempt + 1}/${pollDelays.length})`);
        await sleep(pollDelays[attempt]);

        console.log(`[GIA:UI] reconciling turnId=${turnId} attempt=${attempt + 1}`);
        reconciled = await goatAIChatService.reconcileTurn(turnId, conversationId);

        if (reconciled) {
          console.log(`[GIA:UI] reconcile_status turnId=${turnId} status=${reconciled.status}`);
          if (reconciled.status === "completed" && reconciled.reply) {
            toast.success("Resposta recuperada do servidor!");
            const assistantMsg: ChatMessage = {
              id: reconciled.assistantMessageId || `rec_${Date.now()}`,
              conversation_id: reconciled.conversationId || conversationId || "new",
              role: "assistant",
              content: reconciled.reply,
              message_type: "text",
              created_at: new Date().toISOString(),
              turn_id: turnId,
              turn_status: "completed",
            };
            setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, assistantMsg]);
            if (!conversationId && reconciled.conversationId) {
              setConversationId(reconciled.conversationId);
              onConversationCreated?.(reconciled.conversationId);
            }
            return;
          }

          if (reconciled.status === "partial" && reconciled.reply) {
            toast.warning("Resposta parcial recuperada!");
            const assistantMsg: ChatMessage = {
              id: reconciled.assistantMessageId || `rec_${Date.now()}`,
              conversation_id: reconciled.conversationId || conversationId || "new",
              role: "assistant",
              content: reconciled.reply,
              message_type: "text",
              created_at: new Date().toISOString(),
              turn_id: turnId,
              turn_status: "partial",
            };
            setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, assistantMsg]);
            return;
          }

          if (reconciled.status === "failed") {
            const assistantMsg: ChatMessage = {
              id: `err_${Date.now()}`,
              conversation_id: conversationId || "new",
              role: "assistant",
              content: reconciled.errorMessage || "Não foi possível concluir o processamento no servidor.",
              message_type: "text",
              created_at: new Date().toISOString(),
              turn_id: turnId,
              turn_status: "failed",
              is_error: true,
            };
            setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, assistantMsg]);
            return;
          }

          if (reconciled.status === "cancelled") {
            toast.info("Turno cancelado.");
            return;
          }
        }
      }

      // If after all polling attempts the turn was still processing or unresolved:
      toast.error("O processamento da GIA está demorando mais que o esperado.");
      const unconfirmedMsg: ChatMessage = {
        id: `timeout_${Date.now()}`,
        conversation_id: conversationId || "new",
        role: "assistant",
        content: "A resposta da GIA demorou mais que o esperado na conexão HTTP. O servidor pode ainda estar processando.",
        message_type: "text",
        created_at: new Date().toISOString(),
        turn_id: turnId,
        turn_status: "processing",
        is_error: true,
      };
      setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, unconfirmedMsg]);
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
      <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-surface/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 shrink-0 rounded-full border border-primary/40 overflow-hidden bg-surface-active flex items-center justify-center shadow-sm ring-2 ring-primary/10">
            <img
              src={giaAvatar}
              alt="GIA Avatar"
              className="h-full w-full object-cover object-center aspect-square"
            />
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
      <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto py-6">
            <div className="w-24 h-24 shrink-0 rounded-full border-2 border-primary/40 overflow-hidden bg-surface-active mb-4 shadow-xl ring-4 ring-primary/15 flex items-center justify-center">
              <img
                src={giaAvatar}
                alt="GIA - Sua Assistente Inteligente"
                className="w-full h-full object-cover object-center aspect-square"
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
                    <div className="h-8 w-8 shrink-0 rounded-full border border-primary/30 overflow-hidden bg-surface-active flex items-center justify-center text-primary mt-0.5 shadow-xs">
                      <img
                        src={giaAvatar}
                        alt="GIA"
                        className="h-full w-full object-cover object-center aspect-square"
                      />
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

                    {/* Partial Response Banner */}
                    {!isUser && msg.turn_status === "partial" && (
                      <div className="mt-2.5 pt-2 border-t border-amber-500/30 flex items-center gap-1.5 text-[11px] text-amber-500 font-medium">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>Resposta parcial: limite de tempo atingido antes da síntese completa. Os dados exibidos foram validados no sistema.</span>
                      </div>
                    )}

                    {/* Error / Reconcile Controls */}
                    {!isUser && msg.is_error && (
                      <div className="mt-3 pt-2.5 border-t border-destructive/20 flex flex-wrap items-center gap-3">
                        {msg.turn_id && (
                          <button
                            type="button"
                            onClick={() => handleCheckTurnStatus(msg.turn_id!)}
                            disabled={loading}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                          >
                            <Clock className="h-3 w-3" />
                            Verificar status do turno
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const idx = messages.findIndex((m) => m.id === msg.id);
                            const prevUserMsg = idx > 0 ? messages[idx - 1] : null;
                            if (prevUserMsg && prevUserMsg.role === "user") {
                              handleSendMessage(undefined, prevUserMsg.content);
                            }
                          }}
                          disabled={loading}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive hover:underline cursor-pointer ml-auto"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Tentar novamente
                        </button>
                      </div>
                    )}
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
                <div className="h-8 w-8 shrink-0 rounded-full border border-primary/30 overflow-hidden bg-surface-active flex items-center justify-center text-primary animate-pulse shadow-xs">
                  <img
                    src={giaAvatar}
                    alt="GIA"
                    className="h-full w-full object-cover object-center opacity-80 aspect-square"
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
