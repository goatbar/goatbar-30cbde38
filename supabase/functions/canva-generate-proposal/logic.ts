import {
  formatProposalFieldValue,
  resolveProposalField,
} from "../../../src/lib/proposal-field-resolver.ts";

export type Mapping = {
  canva_field_key: string;
  source_type?: string;
  source_field_key?: string | null;
  static_value?: string | null;
  formatter?: string;
  required?: boolean;
};

export class ProposalGenerationError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function isEmptyProposalValue(value: unknown) {
  if (value == null) return true;
  if (typeof value === "string") return !value.trim();
  if (Array.isArray(value)) return value.every(isEmptyProposalValue);
  return false;
}

export function getMissingCanvaMappingKeys(mappings: Mapping[], datasetKeys: string[]) {
  const available = new Set(datasetKeys);
  return [
    ...new Set(
      mappings
        .filter((mapping) => mapping.canva_field_key !== "INICIAIS_NOIVOS")
        .filter((mapping) => !available.has(mapping.canva_field_key))
        .map((mapping) => mapping.canva_field_key),
    ),
  ];
}

export function normalizeProposalEventType(value: string) {
  const normalized = value.toLocaleLowerCase("pt-BR");
  if (normalized.includes("casamento")) return "casamento";
  if (normalized.includes("aniversario") || normalized.includes("aniversário"))
    return "aniversario";
  return "comemoracao";
}

const LABELS: Record<string, string> = {
  "computed.groom_initial": "Nome do noivo",
  "computed.bride_initial": "Nome da noiva",
};

export function buildAutofillData(
  mappings: Mapping[],
  datasetKeys: string[],
  event: any,
  budget: any,
) {
  const available = new Set(datasetKeys);
  const data: Record<string, { type: "text"; text: string }> = {};
  for (const mapping of mappings) {
    if (mapping.canva_field_key === "INICIAIS_NOIVOS") continue;
    if ((mapping.source_type || "field") === "none") continue;
    if (!available.has(mapping.canva_field_key)) {
      throw new ProposalGenerationError(
        "canva_field_missing",
        `O Brand Template não possui o Data Field "${mapping.canva_field_key}". Atualize o template no Canva ou sincronize os campos.`,
      );
    }
    let raw: any;
    if (mapping.source_type === "static") raw = mapping.static_value;
    else {
      if (!mapping.source_field_key)
        throw new ProposalGenerationError(
          "mapping_incomplete",
          `O Data Field "${mapping.canva_field_key}" não possui uma origem configurada.`,
        );
      raw = resolveProposalField(mapping.source_field_key, { event, budget });
    }
    if (mapping.required && isEmptyProposalValue(raw)) {
      throw new ProposalGenerationError(
        "required_field_empty",
        `O campo ${mapping.canva_field_key} não possui valor na versão do orçamento selecionada.`,
        400,
        { field: mapping.canva_field_key, source_key: mapping.source_field_key },
      );
    }
    const value = formatProposalFieldValue(raw, mapping.formatter || "raw");
    data[mapping.canva_field_key] = { type: "text", text: value };
  }
  if (!Object.keys(data).length)
    throw new ProposalGenerationError(
      "mapping_incomplete",
      "Nenhum campo Canva foi configurado para geração.",
    );
  return data;
}

type Fetch = typeof fetch;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function jsonRequest(fetcher: Fetch, url: string, token: string, init?: RequestInit) {
  const response = await fetcher(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      `Canva HTTP ${response.status}: ${body?.message || body?.error?.message || "erro desconhecido"}`,
    );
  return body;
}

async function pollJob(
  fetcher: Fetch,
  url: string,
  token: string,
  failureCode: string,
  sleep = wait,
) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const body = await jsonRequest(fetcher, url, token);
    const job = body.job || body;
    if (job.status === "success") return job;
    if (job.status === "failed")
      throw new ProposalGenerationError(
        failureCode,
        `O job do Canva falhou: ${job.error?.message || "sem detalhes"}`,
        502,
      );
    await sleep(Math.min(500 + attempt * 250, 2000));
  }
  throw new ProposalGenerationError(failureCode, "Tempo limite aguardando o Canva.", 504);
}

export async function autofillAndExportPdf(args: {
  token: string;
  brandTemplateId: string;
  data: Record<string, any>;
  fetcher?: Fetch;
  sleep?: (ms: number) => Promise<any>;
}) {
  const fetcher = args.fetcher || fetch;
  let autofill: any;
  try {
    const created = await jsonRequest(
      fetcher,
      "https://api.canva.com/rest/v1/autofills",
      args.token,
      {
        method: "POST",
        body: JSON.stringify({ brand_template_id: args.brandTemplateId, data: args.data }),
      },
    );
    autofill = await pollJob(
      fetcher,
      `https://api.canva.com/rest/v1/autofills/${encodeURIComponent(created.job.id)}`,
      args.token,
      "canva_autofill_failed",
      args.sleep,
    );
  } catch (error) {
    if (error instanceof ProposalGenerationError) throw error;
    throw new ProposalGenerationError("canva_autofill_failed", String(error), 502);
  }
  const designId = autofill.result?.design?.id;
  if (!designId)
    throw new ProposalGenerationError(
      "canva_autofill_failed",
      "O Canva não retornou o design gerado.",
      502,
    );
  try {
    const created = await jsonRequest(
      fetcher,
      "https://api.canva.com/rest/v1/exports",
      args.token,
      { method: "POST", body: JSON.stringify({ design_id: designId, format: { type: "pdf" } }) },
    );
    const exported = await pollJob(
      fetcher,
      `https://api.canva.com/rest/v1/exports/${encodeURIComponent(created.job.id)}`,
      args.token,
      "canva_export_failed",
      args.sleep,
    );
    const downloadUrl = exported.urls?.[0];
    if (!downloadUrl) throw new Error("URL do PDF ausente");
    return { designId, downloadUrl, autofillJobId: autofill.id, exportJobId: exported.id };
  } catch (error) {
    if (error instanceof ProposalGenerationError) throw error;
    throw new ProposalGenerationError("canva_export_failed", String(error), 502);
  }
}
