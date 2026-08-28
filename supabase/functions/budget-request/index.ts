import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { WhatsAppChannelAdapter } from "../_shared/goat-ai/channel/whatsapp-adapter.ts";
import { createBudgetRequestLink } from "../_shared/budget-request-link.ts";

import {
  getLinkState,
  normalizeBrazilianPhone,
  sanitizePublicDrinks,
  validatePublicBudgetPayload,
  validatePublicLeadContact,
  validatePublicLeadContext,
} from "./logic.ts";

import { notifyNewBudgetRequest } from "./notifier.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const appUrl = () =>
  (Deno.env.get("PUBLIC_APP_URL") || Deno.env.get("SITE_URL") || "").replace(
    /\/$/,
    "",
  );

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json(
      {
        error: "Método não permitido.",
      },
      405,
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );

  try {
    const body = await req.json();
    const action = body.action;

    const notify = (eventId: string, retry = false) =>
      notifyNewBudgetRequest(
        eventId,
        {
          claim: async (id, isRetry) => {
            const { data, error } = await supabase.rpc(
              "claim_budget_request_notification",
              {
                p_event_id: id,
                p_retry: isRetry,
              },
            );

            if (error) {
              throw error;
            }

            return data?.id ? data : null;
          },

          loadEvent: async (id) => {
            const { data, error } = await supabase
              .from("events")
              .select("*")
              .eq("id", id)
              .single();

            if (error) {
              throw error;
            }

            return data;
          },

          recipients: async () => {
            const { data, error } = await supabase
              .from("user_messaging_accounts")
              .select("phone_number")
              .eq("provider", "whatsapp")
              .eq("verified", true)
              .eq("receive_new_budget_notifications", true)
              .not("phone_number", "is", null);

            if (error) {
              throw error;
            }

            return data || [];
          },

          send: (phone, message, correlationId) =>
            new WhatsAppChannelAdapter(supabase).sendTextMessage(
              phone,
              message,
              correlationId,
            ),

          finish: async (linkId, sent, error) => {
            const { error: updateError } = await supabase
              .from("budget_request_links")
              .update(
                sent
                  ? {
                      notification_status: "SENT",
                      notification_sent_at: new Date().toISOString(),
                      notification_error: null,
                    }
                  : {
                      notification_status: "FAILED",
                      notification_error: error || "Falha desconhecida.",
                    },
              )
              .eq("id", linkId);

            if (updateError) {
              throw updateError;
            }
          },

          eventUrl: (id) =>
            appUrl() ? `${appUrl()}/eventos/${id}` : undefined,
        },
        retry,
      );

    if (action === "create") {
      const bearer =
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";

      const {
        data: { user },
      } = await supabase.auth.getUser(bearer);

      if (!user) {
        return json(
          {
            error: "Não autorizado.",
          },
          401,
        );
      }

      const baseUrl = appUrl();

      if (!baseUrl) {
        return json(
          {
            error: "PUBLIC_APP_URL não configurada.",
          },
          500,
        );
      }

      const metadata =
        body.metadata &&
        typeof body.metadata === "object" &&
        !Array.isArray(body.metadata)
          ? {
              customer_name_hint: String(
                body.metadata.customer_name_hint || "",
              )
                .trim()
                .slice(0, 120),
            }
          : {};

      return json(
        await createBudgetRequestLink(supabase, {
          createdBy: user.id,
          metadata,
          baseUrl,
          expiresInDays: Number(body.expires_in_days) || undefined,
        }),
      );
    }

    if (action === "retry_notification") {
      const bearer =
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";

      const {
        data: { user },
      } = await supabase.auth.getUser(bearer);

      if (!user) {
        return json(
          {
            error: "Não autorizado.",
          },
          401,
        );
      }

      if (typeof body.event_id !== "string") {
        return json(
          {
            error: "event_id inválido.",
          },
          400,
        );
      }

      return json({
        notification_status: await notify(body.event_id, true),
      });
    }

    if (action === "start_public_journey") {
      const context = validatePublicLeadContext(body.context);

      await supabase
        .from("lead_journeys")
        .upsert(
          {
            session_id: context.session_id,
            visitor_id: context.visitor_id,
            source: context.source || null,
            utm_source: context.utm_source || null,
            utm_medium: context.utm_medium || null,
            utm_campaign: context.utm_campaign || null,
            utm_content: context.utm_content || null,
            utm_term: context.utm_term || null,
            referrer: context.referrer || null,
            landing_page: context.landing_page || null,
            last_activity_at: new Date().toISOString(),
          },
          { onConflict: "session_id" },
        );

      const { data: drinks, error: drinksError } = await supabase
        .from("drinks")
        .select(
          "id,nome,descricao,imagem,insumos,modality_config,show_in_public_menu",
        )
        .eq("show_in_public_menu", true);

      if (drinksError) {
        throw drinksError;
      }

      return json({
        state: "ACTIVE",
        public_drinks: sanitizePublicDrinks(drinks || []),
      });
    }

    if (action === "capture_public_lead") {
      const context = validatePublicLeadContext(body.context);
      const contact = validatePublicLeadContact(body.contact);
      const normalizedPhone = normalizeBrazilianPhone(contact.phone);

      const { data: existingLead } = await supabase
        .from("leads")
        .select("id, stage")
        .eq("whatsapp_normalized", normalizedPhone)
        .maybeSingle();

      let leadId = existingLead?.id;

      if (existingLead) {
        const updateData: Record<string, unknown> = {
          name: contact.client_name,
          whatsapp: contact.phone,
          last_activity_at: new Date().toISOString(),
        };
        if (contact.email) updateData.email = contact.email;
        if (
          !["SUBMITTED", "PROPOSAL_CREATED", "CONVERTED"].includes(
            existingLead.stage,
          )
        ) {
          updateData.stage = "CONTACT_CAPTURED";
        }
        await supabase.from("leads").update(updateData).eq("id", existingLead.id);
      } else {
        const { data: newLead, error: insertError } = await supabase
          .from("leads")
          .insert({
            name: contact.client_name,
            whatsapp: contact.phone,
            whatsapp_normalized: normalizedPhone,
            email: contact.email || null,
            stage: "CONTACT_CAPTURED",
            source: context.source || "Site",
            last_activity_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (insertError) {
          throw insertError;
        }
        leadId = newLead.id;
      }

      const { data: journey } = await supabase
        .from("lead_journeys")
        .upsert(
          {
            session_id: context.session_id,
            visitor_id: context.visitor_id,
            lead_id: leadId,
            source: context.source || null,
            utm_source: context.utm_source || null,
            utm_medium: context.utm_medium || null,
            utm_campaign: context.utm_campaign || null,
            utm_content: context.utm_content || null,
            utm_term: context.utm_term || null,
            referrer: context.referrer || null,
            landing_page: context.landing_page || null,
            last_activity_at: new Date().toISOString(),
          },
          { onConflict: "session_id" },
        )
        .select("id")
        .single();

      if (journey?.id && leadId) {
        await supabase
          .from("lead_funnel_events")
          .upsert(
            {
              journey_id: journey.id,
              lead_id: leadId,
              event_name: "lead_captured",
              event_key: `lead_captured:${context.session_id}`,
              metadata: {
                client_name: contact.client_name,
                phone: contact.phone,
                email: contact.email,
              },
              created_at: new Date().toISOString(),
            },
            { onConflict: "journey_id,event_key", ignoreDuplicates: true },
          );
      }

      return json({
        lead_id: leadId,
        state: "CONTACT_CAPTURED",
      });
    }

    if (action === "submit_public_lead_request") {
      const context = validatePublicLeadContext(body.context);
      const payload = validatePublicBudgetPayload(body.payload);
      const normalizedPhone = normalizeBrazilianPhone(payload.phone);

      const { data: existingJourney } = await supabase
        .from("lead_journeys")
        .select("id, lead_id")
        .eq("session_id", context.session_id)
        .maybeSingle();

      let journeyId = existingJourney?.id;
      let leadId = existingJourney?.lead_id;

      if (!journeyId) {
        const { data: newJourney } = await supabase
          .from("lead_journeys")
          .insert({
            session_id: context.session_id,
            visitor_id: context.visitor_id,
            source: context.source || null,
            utm_source: context.utm_source || null,
            utm_medium: context.utm_medium || null,
            utm_campaign: context.utm_campaign || null,
            utm_content: context.utm_content || null,
            utm_term: context.utm_term || null,
            referrer: context.referrer || null,
            landing_page: context.landing_page || null,
            last_activity_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        journeyId = newJourney?.id;
      }

      if (journeyId) {
        const { data: existingSubmitEvent } = await supabase
          .from("lead_funnel_events")
          .select("event_id")
          .eq("journey_id", journeyId)
          .eq("event_key", `public_request_submitted:${context.session_id}`)
          .maybeSingle();

        if (existingSubmitEvent?.event_id) {
          return json({
            state: "USED",
            idempotent: true,
            event_id: existingSubmitEvent.event_id,
          });
        }
      }

      const requestedDrinkIds = payload.requested_drink_ids || [];
      if (requestedDrinkIds.length > 0) {
        const { data: validDrinks, error: drinksCheckError } = await supabase
          .from("drinks")
          .select("id")
          .in("id", requestedDrinkIds)
          .eq("show_in_public_menu", true);

        if (drinksCheckError) {
          throw drinksCheckError;
        }

        const validIds = new Set((validDrinks || []).map((d) => d.id));
        const invalid = requestedDrinkIds.filter((id) => !validIds.has(id));
        if (invalid.length > 0) {
          throw new Error(
            "Um ou mais drinks selecionados não estão disponíveis na carta pública.",
          );
        }
      }

      const { data: event, error: eventError } = await supabase
        .from("events")
        .insert({
          client_name: payload.client_name,
          event_name: payload.event_name || null,
          phone: payload.phone || null,
          email: payload.email || null,
          date: payload.date,
          event_time: payload.event_time || null,
          duration_hours: payload.duration_hours,
          event_location: payload.event_location || null,
          city: payload.city || null,
          event_type: payload.event_type,
          guests: payload.guests,
          lead_source: payload.lead_source || "Formulário público",
          referral_name: payload.referral_name || null,
          notes: payload.notes || null,
          groom_name: payload.groom_name || null,
          bride_name: payload.bride_name || null,
          status: "novo_orcamento",
        })
        .select("id")
        .single();

      if (eventError) {
        throw eventError;
      }
      const eventId = event.id;

      if (requestedDrinkIds.length > 0) {
        const drinkRows = requestedDrinkIds.map((drinkId) => ({
          event_id: eventId,
          drink_id: drinkId,
        }));
        const { error: reqDrinksError } = await supabase
          .from("event_requested_drinks")
          .insert(drinkRows);

        if (reqDrinksError) {
          console.error(
            "[budget-request] error saving requested drinks:",
            reqDrinksError,
          );
        }
      }

      const { data: existingLead } = await supabase
        .from("leads")
        .select("id")
        .eq("whatsapp_normalized", normalizedPhone)
        .maybeSingle();

      if (existingLead) {
        leadId = existingLead.id;
        await supabase
          .from("leads")
          .update({
            name: payload.client_name,
            whatsapp: payload.phone,
            email: payload.email || null,
            event_type: payload.event_type,
            event_date: payload.date,
            guest_count: payload.guests,
            event_id: eventId,
            stage: "SUBMITTED",
            last_activity_at: new Date().toISOString(),
          })
          .eq("id", existingLead.id);
      } else {
        const { data: newLead } = await supabase
          .from("leads")
          .insert({
            name: payload.client_name,
            whatsapp: payload.phone,
            whatsapp_normalized: normalizedPhone,
            email: payload.email || null,
            event_type: payload.event_type,
            event_date: payload.date,
            guest_count: payload.guests,
            event_id: eventId,
            stage: "SUBMITTED",
            source: payload.lead_source || context.source || "Site",
            last_activity_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (newLead) leadId = newLead.id;
      }

      if (journeyId) {
        await supabase
          .from("lead_journeys")
          .update({
            lead_id: leadId,
            last_activity_at: new Date().toISOString(),
          })
          .eq("id", journeyId);

        await supabase.from("lead_funnel_events").insert({
          journey_id: journeyId,
          lead_id: leadId,
          event_id: eventId,
          event_name: "public_request_submitted",
          event_key: `public_request_submitted:${context.session_id}`,
          metadata: {
            client_name: payload.client_name,
            phone: payload.phone,
            guests: payload.guests,
            date: payload.date,
            event_type: payload.event_type,
          },
          created_at: new Date().toISOString(),
        });
      }

      console.log(
        `[budget-request] public event created event_id=${eventId}`,
      );

      await notify(eventId);

      return json({
        state: "USED",
        idempotent: false,
        event_id: eventId,
      });
    }

    const token =
      typeof body.token === "string" && /^[a-f0-9]{64}$/.test(body.token)
        ? body.token
        : "";

    if (!token) {
      return json(
        {
          state: "INVALID",
        },
        404,
      );
    }

    const { data: link, error: linkError } = await supabase
      .from("budget_request_links")
      .select(
        "id,status,expires_at,used_at,cancelled_at,event_id,metadata",
      )
      .eq("token", token)
      .maybeSingle();

    if (linkError) {
      throw linkError;
    }

    const state = getLinkState(link);

    if (action === "validate") {
      if (state !== "ACTIVE") {
        return json({
          state,
        });
      }

      const { data: drinks, error: drinksError } = await supabase
        .from("drinks")
        .select(
          "id,nome,descricao,imagem,insumos,modality_config,show_in_public_menu",
        )
        .eq("show_in_public_menu", true);

      if (drinksError) {
        throw drinksError;
      }

      return json({
        state,
        metadata: link?.metadata,
        public_drinks: sanitizePublicDrinks(drinks || []),
      });
    }

    if (action !== "submit") {
      return json(
        {
          error: "Ação inválida.",
        },
        400,
      );
    }

    if (state !== "ACTIVE" && state !== "USED") {
      return json(
        {
          state,
        },
        state === "INVALID" ? 404 : 409,
      );
    }

    const payload = validatePublicBudgetPayload(body.payload);

    const { data: result, error: rpcError } = await supabase.rpc(
      "consume_budget_request_link",
      {
        p_token: token,
        p_client_name: payload.client_name,
        p_event_name: payload.event_name || "",
        p_phone: payload.phone,
        p_email: payload.email || "",
        p_date: payload.date,
        p_event_time: payload.event_time || "",
        p_event_location: payload.event_location || "",
        p_city: payload.city || "",
        p_event_type: payload.event_type,
        p_guests: payload.guests,
        p_lead_source: payload.lead_source || "",
        p_referral_name: payload.referral_name || "",
        p_notes: payload.notes || "",
        p_groom_name: payload.groom_name || "",
        p_bride_name: payload.bride_name || "",
        p_duration_hours: payload.duration_hours,
        p_requested_drink_ids: payload.requested_drink_ids || [],
      },
    );

    if (rpcError) {
      throw rpcError;
    }

    if (result.state === "CREATED") {
      console.log(
        `[budget-request] event created event_id=${result.event_id}`,
      );

      await notify(result.event_id);
    }

    return json({
      state: result.state === "CREATED" ? "USED" : result.state,
      idempotent: Boolean(result.idempotent),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    const validation = /inválid|obrigatório|permitidos/i.test(message);

    console.error("[budget-request]", message);

    return json(
      {
        error: validation
          ? message
          : "Não foi possível processar a solicitação.",
      },
      validation ? 400 : 500,
    );
  }
});