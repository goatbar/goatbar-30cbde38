import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xdqgglrxidmegujhkygj.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkcWdnbHJ4aWRtZWd1amhreWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjA1ODYsImV4cCI6MjA5MzQ5NjU4Nn0.RXTdfcAvprj39bgoLUYuKxHao4q1ArdXxbKwG9k7ors";

const promptMessage = "Gia, me manda os drinks do evento da Isidora e inclua a descrição dos drinks";

async function callGiaChat(message: string, conversationId?: string) {
  const url = `${SUPABASE_URL}/functions/v1/goat-ai-chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      action: "chat",
      message,
      conversationId: conversationId || undefined,
    }),
  });

  const status = res.status;
  const json = await res.json();
  return { status, json };
}

async function main() {
  console.log("=== STEP 1: Calling GIA Turn 1 (Event Drinks Query) ===");
  const prompt1 = "Gia, me manda os drinks do evento da Isidora e inclua a descrição dos drinks";
  console.log(`Prompt 1: "${prompt1}"`);
  
  const start1 = Date.now();
  const run1 = await callGiaChat(prompt1);
  const convId = run1.json.conversationId;
  console.log(`HTTP Status: ${run1.status} (took ${Date.now() - start1}ms)`);
  console.log("Turn 1 summary:", {
    success: run1.json.success,
    conversationId: convId,
    toolsExecuted: run1.json.toolCallsExecuted?.map((t: any) => t.toolName || t.name),
    replyPreview: run1.json.reply?.slice(0, 200),
  });

  console.log("\n=== STEP 2: Calling GIA Turn 2 on SAME Conversation ID ===");
  const prompt2 = "Quantos convidados tem esse evento que você acabou de listar?";
  console.log(`Prompt 2: "${prompt2}"`);
  console.log(`Using conversationId: ${convId}`);

  const start2 = Date.now();
  const run2 = await callGiaChat(prompt2, convId);
  console.log(`HTTP Status: ${run2.status} (took ${Date.now() - start2}ms)`);
  console.log("Turn 2 summary:", {
    success: run2.json.success,
    conversationId: run2.json.conversationId,
    sameConversationId: run2.json.conversationId === convId,
    reply: run2.json.reply,
  });

  console.log("\n=== STEP 3: Verifying Conversation in Database ===");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: conv } = await supabase
    .from("ai_conversations")
    .select("id, title, channel, metadata, updated_at")
    .eq("id", convId)
    .single();

  console.log("Database conversation record:", {
    id: conv?.id,
    title: conv?.title,
    channel: conv?.channel,
    updated_at: conv?.updated_at,
    metadata_keys: Object.keys(conv?.metadata || {}),
  });

  const { data: messages } = await supabase
    .from("ai_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true });

  console.log(`Total messages in conversation ${convId}: ${messages?.length || 0}`);
  messages?.forEach((m, i) => {
    console.log(` [${i + 1}] ${m.role.toUpperCase()}: ${m.content.slice(0, 80).replace(/\n/g, " ")}...`);
  });
}

main().catch((err) => {
  console.error("Error in script:", err);
  process.exit(1);
});
