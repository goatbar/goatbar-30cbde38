import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useState } from "react";
import { GoatAIChatView } from "@/components/goat-ai/GoatAIChatView";
import { GoatAIConversationsView } from "@/components/goat-ai/GoatAIConversationsView";
import { GoatAIAuditView } from "@/components/goat-ai/GoatAIAuditView";
import { GoatAIIntegrationsView } from "@/components/goat-ai/GoatAIIntegrationsView";
import {
  Sparkles,
  MessageSquare,
  History,
  ShieldCheck,
  Cpu,
  Layers,
} from "lucide-react";

export const Route = createFileRoute("/goat-ai")({
  component: () => (
    <AppShell>
      <GoatAIPage />
    </AppShell>
  ),
});

function GoatAIPage() {
  const [activeTab, setActiveTab] = useState<"chat" | "conversas" | "auditoria" | "integracoes">("chat");
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();

  const handleSelectConversation = (convId: string) => {
    setSelectedConversationId(convId);
    setActiveTab("chat");
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Goat AI"
        subtitle="Assistente operacional inteligente conectado a eventos, fechamentos e controladoria"
      />

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "chat"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Chat Assistente
        </button>

        <button
          onClick={() => setActiveTab("conversas")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "conversas"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          Conversas
        </button>

        <button
          onClick={() => setActiveTab("auditoria")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "auditoria"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Auditoria & Logs
        </button>

        <button
          onClick={() => setActiveTab("integracoes")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "integracoes"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
          }`}
        >
          <Cpu className="h-4 w-4" />
          Integrações (WhatsApp & Gemini)
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "chat" && (
        <GoatAIChatView
          conversationId={selectedConversationId}
          onConversationCreated={(id) => setSelectedConversationId(id)}
        />
      )}

      {activeTab === "conversas" && (
        <GoatAIConversationsView onSelectConversation={handleSelectConversation} />
      )}

      {activeTab === "auditoria" && <GoatAIAuditView />}

      {activeTab === "integracoes" && <GoatAIIntegrationsView />}
    </div>
  );
}
