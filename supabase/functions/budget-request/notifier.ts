import { normalizePhoneNumber } from "../_shared/goat-ai/phone-normalizer.ts";
import { type WhatsAppSendResult } from "../_shared/goat-ai/channel/whatsapp-adapter.ts";
import { type PublicBudgetPayload } from "./logic.ts";

export interface NotificationDependencies {
  claim(eventId: string, retry: boolean): Promise<{ id: string } | null>;
  loadEvent(eventId: string): Promise<(PublicBudgetPayload & { id?: string }) | null>;
  recipients(): Promise<Array<{ phone_number: string }>>;
  send(phone: string, parameters: string[], correlationId: string): Promise<boolean | WhatsAppSendResult>;
  finish(linkId: string, sent: boolean, error?: string): Promise<void>;
  eventUrl(eventId: string): string | undefined;
  notifyInternal?(event: PublicBudgetPayload & { id?: string }, eventUrl?: string): Promise<boolean>;
}

const masked = (phone: string) => `${phone.slice(0, 4)}***${phone.slice(-4)}`;

export async function notifyNewBudgetRequest(
  eventId: string,
  deps: NotificationDependencies,
  retry = false,
): Promise<"SENT" | "FAILED" | "SKIPPED"> {
  const claim = await deps.claim(eventId, retry);
  if (!claim) return "SKIPPED";

  const correlationId = `budget_${eventId}`;
  const templateName =
    (typeof Deno !== "undefined" && Deno.env?.get?.("WHATSAPP_BUDGET_REQUEST_TEMPLATE")) ||
    "novo_orcamento_recebido";

  try {
    const event = await deps.loadEvent(eventId);
    if (!event) throw new Error("Evento da solicitação não encontrado.");

    const eventUrl = deps.eventUrl(eventId);

    // 1. Internal system notification for GIA & panel (Idempotent & separate from user messages)
    if (deps.notifyInternal) {
      try {
        await deps.notifyInternal({ ...event, id: eventId }, eventUrl);
        console.log(`[budget-request] internal notification recorded event_id=${eventId}`);
      } catch (internalErr: any) {
        console.error(`[budget-request] internal notification error event_id=${eventId}:`, internalErr);
      }
    }

    const recipients = await deps.recipients();
    console.log(
      `[budget-request] notification recipients=${recipients.length} event_id=${eventId}`,
    );
    if (!recipients.length) {
      throw new Error("NO_RECIPIENTS: Nenhum destinatário WhatsApp verificado com 'receive_new_budget_notifications=true' encontrado.");
    }

    // Sanitize parameters to guarantee non-empty strings (Meta rejects empty/null variables)
    const parameters = [
      (event.client_name || "Cliente").trim(),
      (event.event_name || event.event_type || "Evento").trim(),
      (event.date || "A definir").trim(),
      String(event.guests ?? "A definir"),
      (event.phone || "Não informado").trim(),
    ];

    for (const recipient of recipients) {
      const phone = normalizePhoneNumber(recipient.phone_number).canonicalPlain;
      if (!phone) {
        throw new Error(`INVALID_RECIPIENT: Telefone '${masked(recipient.phone_number)}' inválido após normalização.`);
      }

      console.log(
        `[budget-request] sending whatsapp recipient=${masked(phone)} event_id=${eventId}`,
      );

      const sendResult = await deps.send(phone, parameters, correlationId);
      const isSuccess = typeof sendResult === "boolean" ? sendResult : sendResult?.success;

      if (!isSuccess) {
        if (typeof sendResult === "object" && sendResult !== null) {
          const { errorCategory = "META_REJECTED", httpStatus, metaErrorCode, metaErrorMessage, errorReason } = sendResult;
          if (errorCategory === "META_REJECTED") {
            throw new Error(`META_REJECTED: HTTP ${httpStatus || "unknown"} code=${metaErrorCode ?? "none"} message="${metaErrorMessage || "Meta rejeitou a mensagem"}" template="${templateName}" correlationId="${correlationId}"`);
          } else if (errorCategory === "WHATSAPP_NOT_CONFIGURED") {
            throw new Error(`WHATSAPP_NOT_CONFIGURED: ${errorReason || "Credenciais da Meta ausentes no ambiente."}`);
          } else if (errorCategory === "NETWORK_ERROR") {
            throw new Error(`NETWORK_ERROR: ${errorReason || "Falha de rede ao contatar API da Meta."}`);
          } else if (errorCategory === "INVALID_RECIPIENT") {
            throw new Error(`INVALID_RECIPIENT: ${errorReason || "Telefone inválido para entrega."}`);
          } else {
            throw new Error(`${errorCategory}: ${errorReason || "Falha desconhecida no envio WhatsApp."}`);
          }
        }
        throw new Error(`META_REJECTED: Meta WhatsApp API não aceitou a mensagem; consulte os logs do adapter template="${templateName}" correlationId="${correlationId}".`);
      }
    }

    await deps.finish(claim.id, true);
    console.log(`[budget-request] notification sent event_id=${eventId}`);
    return "SENT";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await deps.finish(claim.id, false, message.slice(0, 1000));
    console.error(`[budget-request] notification failed event_id=${eventId} error=${message}`);
    return "FAILED";
  }
}
