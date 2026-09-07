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

export const NEW_BUDGET_NOTIFICATION_RECIPIENTS = [
  "+5531996970935",
  "+5537999985192",
] as const;

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

    // New-budget alerts are an operational Goat Bar notification, not a
    // per-user WhatsApp preference. Keep the destination allowlist explicit so
    // a newly linked GIA account can never start receiving these alerts by
    // accident and a missing receive_new_budget_notifications flag cannot block
    // delivery to the two approved numbers.
    const recipients = NEW_BUDGET_NOTIFICATION_RECIPIENTS.map((phone_number) => ({
      phone_number,
    }));

    console.log(
      `[budget-request] notification recipients=${recipients.length} source=fixed_allowlist event_id=${eventId}`,
    );

    const parameters = [
      event.client_name,
      event.event_name || event.event_type,
      event.date,
      String(event.guests),
      event.phone,
    ];

    for (const recipient of recipients) {
      const phone = normalizePhoneNumber(recipient.phone_number).canonicalPlain;
      if (!phone) throw new Error("Destinatário configurado possui telefone inválido.");
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
