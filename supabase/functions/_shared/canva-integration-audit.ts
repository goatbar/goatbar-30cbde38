export type CanvaIntegrationAuditRow = {
  user_id: string;
  canva_user_id: string | null;
  scopes: string[] | null;
  updated_at: string;
  access_token_expires_at: string;
  access_token: string;
};

/** The query is ordered newest-first; secrets are used for comparison and then discarded. */
export function summarizeCanvaIntegrations(
  rows: CanvaIntegrationAuditRow[],
  accessTokenUsed: string,
) {
  const latest = rows[0];
  if (!latest) return null;
  return {
    user_id: latest.user_id,
    canva_user_id: latest.canva_user_id,
    scopes: latest.scopes ?? [],
    updated_at: latest.updated_at,
    access_token_expires_at: latest.access_token_expires_at,
    integration_count: rows.length,
    duplicate_integration: rows.length > 1,
    token_matches_latest_integration: latest.access_token === accessTokenUsed,
  };
}
