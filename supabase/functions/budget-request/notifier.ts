import { normalizePhoneNumber } from "../_shared/goat-ai/phone-normalizer.ts";
import { type PublicBudgetPayload } from "./logic.ts";

export interface NotificationDependencies {
  claim(eventId: string, retry: boolean): Promise<{ id: string } | null>;
  loadEvent(eventId: string): Promise<PublicBudgetPayload | null>;
  recipients(): Promise<Array<{ phone_number: string }>>;
  send(phone: string, parameters: string[], correlationId: string): Promise<boolean>;
  finish(linkId: string, sent: boolean, error?: string): Promise<void>;
  eventUrl(eventId: string): string | undefined;
}

const masked = (phone: string) => `${phone.slice(0, 4)}***${phone.slice(-4)}`;

export async function notifyNewBudgetRequest(
  eventId: string,
  deps: NotificationDependencies,
  retry = false,
): Promise<"SENT" | "FAILED" | "SKIPPED"> {
  const claim = await deps.claim(eventId, retry);
  if (!claim) return "SKIPPED";

  try {
    const event = await deps.loadEvent(eventId);
    if (!event) throw new Error("Evento da solicitação não encontrado.");
    const recipients = await deps.recipients();
    console.log(
      `[budget-request] notification recipients=${recipients.length} event_id=${eventId}`,
    );
    if (!recipients.length)
      throw new Error("Nenhum destinatário habilitado para novos orçamentos.");

    const parameters = [
      event.client_name,
      event.event_name || event.event_type,
      event.date,
      String(event.guests),
      event.phone,
    ];
    for (const recipient of recipients) {
      const phone = normalizePhoneNumber(recipient.phone_number).canonicalPlain;
      if (!phone) throw new Error("Destinatário habilitado possui telefone inválido.");
      console.log(
        `[budget-request] sending whatsapp recipient=${masked(phone)} event_id=${eventId}`,
      );
      if (!(await deps.send(phone, parameters, `budget_${eventId}`))) {
        throw new Error("Meta WhatsApp API não aceitou a mensagem; consulte os logs do adapter.");
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
