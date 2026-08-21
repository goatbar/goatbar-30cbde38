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
  ShieldCheck,
  Cpu,
} from "lucide-react";

export const Route = createFileRoute("/gia")({
  component: () => (
    <AppShell>
      <GiaPage />
    </AppShell>
  ),
});

export function GiaPage() {
  const [activeTab, setActiveTab] = useState<"chat" | "conversas" | "auditoria" | "integracoes">("chat");
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();

  const handleSelectConversation = (convId: string) => {
    setSelectedConversationId(convId);
    setActiveTab("chat");
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="GIA"
        subtitle="Assistente inteligente do Goat Bar"
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
          Chat GIA
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
          Auditoria da GIA
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
          Configurações da GIA
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
