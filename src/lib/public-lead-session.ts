const VISITOR_KEY = "goatbar_public_visitor_id";
const SESSION_KEY = "goatbar_public_quote_session_id";

const uuid = () => crypto.randomUUID();

export function getPublicLeadContext() {
  const storage = window.localStorage;
  let visitor_id = storage.getItem(VISITOR_KEY);
  let session_id = storage.getItem(SESSION_KEY);
  if (!visitor_id) {
    visitor_id = uuid();
    storage.setItem(VISITOR_KEY, visitor_id);
  }
  if (!session_id) {
    session_id = uuid();
    storage.setItem(SESSION_KEY, session_id);
  }

  const params = new URLSearchParams(window.location.search);
  const referrer = document.referrer || "";
  const utm_source = params.get("utm_source") || "";
  const source = deriveSource(utm_source, referrer);

  return {
    visitor_id,
    session_id,
    source,
    utm_source,
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_content: params.get("utm_content") || "",
    utm_term: params.get("utm_term") || "",
    referrer,
    landing_page: window.location.pathname,
  };
}

export function deriveSource(utmSource: string, referrer: string) {
  const value = `${utmSource} ${referrer}`.toLowerCase();
  if (value.includes("instagram")) return "instagram_bio";
  if (value.includes("whatsapp") || value.includes("wa.me")) return "whatsapp_bio";
  if (value.includes("google")) return "google";
  if (referrer) return "referral";
  return "direct";
}
