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
  "Qual o resumo financeiro de receitas e despesas?",
  "Buscar eventos confirmados para os próximos meses",
  "Registrar fechamento de vendas da 7 Steak House",
];

export function GoatAIChatView({
  conversationId: initialConvId,
  onConversationCreated,
}: GoatAIChatViewProps) {
  const [conversationId, setConversationId] = useState<string | undefined>(initialConvId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [operationalStatus, setOperationalStatus] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<{ base64?: string; name: string; type: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setConversationId(initialConvId);
    if (initialConvId) {
      loadMessages(initialConvId);
    } else {
      setMessages([]);
    }
  }, [initialConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, operationalStatus]);

  const loadMessages = async (convId: string) => {
    try {
      const data = await goatAIChatService.listMessages(convId);
      setMessages(data);
    } catch (err) {
      console.error("Erro ao carregar mensagens:", err);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        setFilePreview({
          base64: reader.result as string,
          name: file.name,
          type: file.type,
        });
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview({
        name: file.name,
        type: file.type,
      });
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async (customText?: string) => {
    const text = (customText || inputValue).trim();
    if (!text && !selectedFile) return;

    setInputValue("");
    setLoading(true);
    setOperationalStatus(selectedFile ? "Lendo documento / imagem..." : "Pensando...");

    // Optimistic user message
    const tempUserMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      conversation_id: conversationId || "new",
      role: "user",
      content: text || (selectedFile ? `[Arquivo: ${selectedFile.name}]` : ""),
      message_type: selectedFile ? "image" : "text",
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      let attachments: any[] = [];
      if (selectedFile) {
        setOperationalStatus("Enviando mídia e analisando com IA...");
        const media = await goatAIChatService.uploadMedia(selectedFile);
        attachments.push({
          mimeType: media.mimeType,
          dataBase64: media.base64,
          url: media.url,
          fileName: selectedFile.name,
        });
        removeSelectedFile();
      }

      setOperationalStatus("Consultando sistema e processando...");

      const response = await goatAIChatService.sendMessage({
        conversationId,
        message: text,
        attachments,
      });

      if (response.conversationId && response.conversationId !== conversationId) {
        setConversationId(response.conversationId);
        onConversationCreated?.(response.conversationId);
      }

      if (response.pendingAction) {
        setPendingAction(response.pendingAction);
      } else {
        setPendingAction(null);
      }

      // Add assistant response
      const assistantMsg: ChatMessage = {
        id: response.messageId || `msg_${Date.now()}`,
        conversation_id: response.conversationId,
        role: "assistant",
        content: response.reply,
        message_type: "text",
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, assistantMsg]);
    } catch (err: any) {
      console.error("Erro ao enviar mensagem:", err);
      toast.error(err?.message || "Erro na comunicação com a Goat AI");
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
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display font-black text-sm tracking-tight text-foreground flex items-center gap-2">
              Goat AI
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/15 text-primary border border-primary/20">
                Assistente Conectado
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Inteligência operacional conectada a eventos, sessões e controladoria
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
            <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 shadow-sm">
              <Sparkles className="h-7 w-7" />
            </div>
            <h4 className="font-display font-bold text-lg text-foreground mb-2">
              Como posso ajudar você hoje?
            </h4>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              Você pode perguntar sobre dados de eventos, médias de consumo, enviar fotos de fechamento de vendas ou notas fiscais para registrar na Controladoria.
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
                    <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? "bg-primary text-primary-foreground font-medium rounded-tr-xs shadow-xs"
                        : "bg-surface-active/60 border border-border/60 text-foreground rounded-tl-xs shadow-xs"
                    }`}
                  >
                    {msg.content}
                  </div>

                  {isUser && (
                    <div className="h-8 w-8 rounded-lg bg-surface-active border border-border/60 flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Operational Status (Thinking/Querying) */}
            {loading && operationalStatus && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div className="bg-surface-active/40 border border-border/40 px-3.5 py-2 rounded-xl italic">
                  {operationalStatus}
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

      {/* Attachment Preview */}
      {filePreview && (
        <div className="px-6 py-2 bg-surface-active/30 border-t border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            {filePreview.base64 ? (
              <img
                src={filePreview.base64}
                alt="Preview"
                className="h-10 w-10 object-cover rounded-lg border border-border"
              />
            ) : (
              <FileText className="h-6 w-6 text-primary" />
            )}
            <div>
              <p className="font-semibold text-foreground truncate max-w-[200px]">{filePreview.name}</p>
              <p className="text-[10px] text-muted-foreground uppercase">{filePreview.type}</p>
            </div>
          </div>
          <button
            onClick={removeSelectedFile}
            className="p-1 rounded-full hover:bg-surface text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Chat Input Bar */}
      <div className="p-4 border-t border-border/60 bg-surface/80">
        <div className="flex items-end gap-2 bg-surface border border-border/80 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 rounded-xl p-2 transition-all">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,application/pdf"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-surface-hover transition-colors cursor-pointer"
            title="Anexar foto ou documento"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem ou comando (ex: 'Quanto gastamos com gelo?')..."
            rows={1}
            disabled={loading}
            className="flex-1 max-h-32 min-h-[38px] py-2 px-1 text-xs bg-transparent border-0 outline-none resize-none text-foreground placeholder:text-muted-foreground"
          />

          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={loading || (!inputValue.trim() && !selectedFile)}
            className="p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-all cursor-pointer shadow-xs"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
