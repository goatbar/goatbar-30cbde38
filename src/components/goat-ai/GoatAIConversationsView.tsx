import React, { useState, useEffect } from "react";
import { MessageSquare, MessageCircle, Globe, Calendar, ChevronRight, Loader2, RotateCcw } from "lucide-react";
import { goatAIChatService, ChatConversation } from "@/services/goat-ai/goat-ai-chat-service";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface GoatAIConversationsViewProps {
  onSelectConversation: (conversationId: string) => void;
}

export function GoatAIConversationsView({ onSelectConversation }: GoatAIConversationsViewProps) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const data = await goatAIChatService.listConversations();
      setConversations(data);
    } catch (err) {
      console.error("Erro ao carregar conversas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  const formatDate = (isoString: string) => {
    try {
      return format(parseISO(isoString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-surface rounded-2xl border border-border/60 shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-base text-foreground">
            Conversas com a GIA
          </h3>
          <p className="text-xs text-muted-foreground">
            Sessões de chat originadas pelo sistema web e pelo WhatsApp
          </p>
        </div>
        <button
          onClick={loadConversations}
          className="p-2 rounded-lg border border-border/60 hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center items-center text-muted-foreground gap-2 text-xs">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Carregando conversas...
        </div>
      ) : conversations.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-xs">
          Nenhuma conversa registrada até o momento.
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((conv) => {
            const isWhatsApp = conv.channel === "whatsapp";
            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className="p-4 rounded-xl border border-border/60 hover:border-primary/40 bg-surface hover:bg-surface-hover transition-all cursor-pointer flex items-center justify-between group shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      isWhatsApp
                        ? "bg-[#22c55e]/10 border-[#22c55e]/30 text-[#22c55e]"
                        : "bg-primary/10 border-primary/20 text-primary"
                    }`}
                  >
                    {isWhatsApp ? (
                      <MessageCircle className="h-5 w-5" />
                    ) : (
                      <Globe className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                      {conv.title || "Conversa com a GIA"}
                    </h4>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                      <span className="capitalize">{conv.channel}</span>
                      <span>•</span>
                      <span>{formatDate(conv.updated_at || conv.created_at)}</span>
                    </div>
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
