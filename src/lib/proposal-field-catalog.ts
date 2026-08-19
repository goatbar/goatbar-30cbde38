// src/lib/proposal-field-catalog.ts
// Official catalog of Goat Bar fields available for Canva Brand Template mapping

export type FieldValueType = "text" | "date" | "number" | "currency" | "list";

export interface ProposalCatalogField {
  key: string;
  label: string;
  group:
    | "Cliente"
    | "Evento"
    | "Orçamento"
    | "Equipe"
    | "Cardápio & Bebidas"
    | "Drinks"
    | "Bebidas"
    | "Empresa"
    | "Campos Formatados / Calculados"
    | "Campos calculados";
  type: FieldValueType;
  description: string;
  example: string;
}

export interface FieldFormatterOption {
  key: string;
  label: string;
  description: string;
}

/** Campos que todo Brand Template de proposta pode mapear, mesmo sem dataset Canva. */
export const OFFICIAL_CANVA_PROPOSAL_FIELDS = [
  "NOME_EVENTO",
  "DATA_ORCAMENTO",
  "DATA_EVENTO",
  "INO",
  "INA",
  "QUANTIDADE_PESSOAS",
  "DRINKS",
  "BEBIDAS",
  "QTD_BARTENDERS",
  "QTD_COPEIRAS",
  "QTD_BAR_KEEPERS",
  "QUANTIDADE_DRINKS",
  "VALOR_INVESTIMENTO",
  "DATA_FINAL_PAGAMENTO",
  "QUANTIDADE_HORAS_EVENTO",
] as const;

export interface CanvaDatasetField {
  key: string;
  name?: string;
  type?: string;
}

export interface CanvaFieldAudit {
  officialCount: number;
  datasetCount: number;
  configuredMappingCount: number;
  validMappingCount: number;
  missingMappingKeys: string[];
}

/** Calcula os contadores sem confundir o catálogo local com o Dataset do Canva. */
export function auditCanvaFields(
  dataset: CanvaDatasetField[],
  mappingKeys: string[],
): CanvaFieldAudit {
  const datasetKeys = new Set(dataset.map((field) => field.key));
  const activeMappingKeys = [...new Set(mappingKeys)].filter((key) => key !== "INICIAIS_NOIVOS");
  const missingMappingKeys = activeMappingKeys.filter((key) => !datasetKeys.has(key));

  return {
    officialCount: OFFICIAL_CANVA_PROPOSAL_FIELDS.length,
    datasetCount: datasetKeys.size,
    configuredMappingCount: activeMappingKeys.length,
    validMappingCount: activeMappingKeys.length - missingMappingKeys.length,
    missingMappingKeys,
  };
}

/** Preserva a ordem oficial e agrega campos extras do Canva, sem duplicar por key. */
export function mergeOfficialCanvaFields(
  dataset: CanvaDatasetField[],
): Required<CanvaDatasetField>[] {
  const canvaByKey = new Map(dataset.map((field) => [field.key, field]));
  const merged: Required<CanvaDatasetField>[] = OFFICIAL_CANVA_PROPOSAL_FIELDS.map((key) => {
    const metadata = canvaByKey.get(key);
    return { key, name: metadata?.name || key, type: metadata?.type || "text" };
  });

  for (const field of dataset) {
    // O Data Field antigo pode continuar no Canva/banco, mas não volta à experiência
    // de configuração de modelos novos.
    if (field.key === "INICIAIS_NOIVOS") continue;
    if (
      !OFFICIAL_CANVA_PROPOSAL_FIELDS.includes(
        field.key as (typeof OFFICIAL_CANVA_PROPOSAL_FIELDS)[number],
      )
    ) {
      merged.push({ key: field.key, name: field.name || field.key, type: field.type || "text" });
    }
  }
  return merged;
}

export const PROPOSAL_FORMATTERS: FieldFormatterOption[] = [
  {
    key: "raw",
    label: "Texto Original (Sem formatação)",
    description: "Insere o valor bruto do sistema.",
  },
  {
    key: "currency",
    label: "Moeda (R$ 1.234,56)",
    description: "Formata valores numéricos como reais.",
  },
  { key: "date_short", label: "Data Curta (DD/MM/AAAA)", description: "Exemplo: 20/10/2026" },
  { key: "date_long", label: "Data por Extenso", description: "Exemplo: 20 de Outubro de 2026" },
  { key: "integer", label: "Número Inteiro", description: "Remove casas decimais." },
  {
    key: "uppercase",
    label: "TUDO EM MAIÚSCULAS",
    description: "Converte o texto para caixa alta.",
  },
  {
    key: "lowercase",
    label: "tudo em minúsculas",
    description: "Converte o texto para caixa baixa.",
  },
  { key: "yes_no", label: "Sim / Não", description: "Converte booleanos para Sim ou Não." },
];

export const PROPOSAL_FIELD_CATALOG: ProposalCatalogField[] = [
  // ─── Cliente ──────────────────────────────────────────────
  {
    key: "event.client_name",
    label: "Nome do Cliente",
    group: "Cliente",
    type: "text",
    description: "Nome do cliente ou casal contratante.",
    example: "Maria & João",
  },
  {
    key: "event.client_email",
    label: "E-mail do Cliente",
    group: "Cliente",
    type: "text",
    description: "E-mail de contato do cliente.",
    example: "cliente@email.com",
  },
  {
    key: "event.client_phone",
    label: "Telefone do Cliente",
    group: "Cliente",
    type: "text",
    description: "Telefone / WhatsApp do cliente.",
    example: "(11) 99999-9999",
  },

  // ─── Evento ───────────────────────────────────────────────
  {
    key: "event.event_name",
    label: "Nome do evento",
    group: "Evento",
    type: "text",
    description: "Título ou identificador do evento.",
    example: "Casamento Maria e João",
  },
  {
    key: "event.event_type",
    label: "Tipo de Evento",
    group: "Evento",
    type: "text",
    description: "Categoria do evento (Casamento, Aniversário, Corporativo, etc.).",
    example: "Casamento",
  },
  {
    key: "event.event_date",
    label: "Data do evento",
    group: "Evento",
    type: "date",
    description: "Data agendada para o evento.",
    example: "2026-10-20",
  },
  {
    key: "event.event_time",
    label: "Horário de Início",
    group: "Evento",
    type: "text",
    description: "Horário de início do bar.",
    example: "19:00",
  },
  {
    key: "event.guest_count",
    label: "Quantidade de pessoas",
    group: "Evento",
    type: "number",
    description: "Quantidade total de convidados previstos.",
    example: "150",
  },
  {
    key: "event.location",
    label: "Local / Cidade",
    group: "Evento",
    type: "text",
    description: "Espaço ou endereço onde ocorrerá o evento.",
    example: "Villa Bisutti - São Paulo/SP",
  },
  {
    key: "event.duration_hours",
    label: "Duração do evento",
    group: "Evento",
    type: "number",
    description: "Total de horas de operação do bar contratadas.",
    example: "6",
  },

  // ─── Orçamento & Pagamento ─────────────────────────────────
  {
    key: "budget.total_value",
    label: "Valor do investimento",
    group: "Orçamento",
    type: "currency",
    description: "Valor total final do orçamento.",
    example: "8500.00",
  },
  {
    key: "budget.created_at",
    label: "Data do orçamento",
    group: "Orçamento",
    type: "date",
    description: "Data real de criação da versão do orçamento.",
    example: "2026-08-19",
  },
  {
    key: "budget.total_drinks",
    label: "Quantidade total de drinks",
    group: "Orçamento",
    type: "number",
    description: "Quantidade calculada como convidados × drinks por pessoa.",
    example: "600",
  },
  {
    key: "budget.discount_value",
    label: "Desconto Aplicado (R$)",
    group: "Orçamento",
    type: "currency",
    description: "Valor do desconto concedido na negociação.",
    example: "500.00",
  },
  {
    key: "budget.payment_terms",
    label: "Condições de Pagamento",
    group: "Orçamento",
    type: "text",
    description: "Texto com as formas de pagamento acordadas.",
    example: "50% na entrada + 50% até 7 dias antes do evento",
  },

  // ─── Equipe ───────────────────────────────────────────────
  {
    key: "budget.bartenders_count",
    label: "Quantidade de Bartenders",
    group: "Equipe",
    type: "number",
    description: "Número de bartenders escalados para o evento.",
    example: "3",
  },
  {
    key: "budget.bar_keepers_count",
    label: "Quantidade de Bar Keepers",
    group: "Equipe",
    type: "number",
    description: "Número de bar keepers / apoio.",
    example: "1",
  },
  {
    key: "budget.copeiras_count",
    label: "Quantidade de Copeiras",
    group: "Equipe",
    type: "number",
    description: "Número de copeiras escaladas.",
    example: "1",
  },

  // ─── Cardápio & Bebidas ───────────────────────────────────
  {
    key: "package.name",
    label: "Nome do Pacote",
    group: "Cardápio & Bebidas",
    type: "text",
    description: "Nome do pacote de drinks contratado.",
    example: "Pacote Premium Ouro",
  },
  {
    key: "package.drinks_count",
    label: "Qtd. de Drinks no Cardápio",
    group: "Cardápio & Bebidas",
    type: "number",
    description: "Total de opções de drinks inclusos.",
    example: "8",
  },
  {
    key: "package.drinks_list",
    label: "Drinks selecionados",
    group: "Drinks",
    type: "list",
    description: "Nomes dos drinks selecionados separados por linha ou vírgula.",
    example: "Moscow Mule, Gin Tropical, Aperol Spritz, Negroni",
  },
  {
    key: "budget.beverages",
    label: "Bebidas selecionadas",
    group: "Bebidas",
    type: "list",
    description: "Bebidas e itens de bebida lançados nesta versão do orçamento.",
    example: "Água, Refrigerante, Espumante",
  },
  {
    key: "package.welcome_drinks",
    label: "Lista de Welcome Drinks",
    group: "Cardápio & Bebidas",
    type: "list",
    description: "Bebidas de recepção inclusas.",
    example: "Espumante Brut, Clericot",
  },
  {
    key: "package.shots",
    label: "Lista de Shots",
    group: "Cardápio & Bebidas",
    type: "list",
    description: "Shots especiais da pista.",
    example: "Mini Beer 43, B-52, Tequila Gold",
  },

  // ─── Empresa ──────────────────────────────────────────────
  {
    key: "company.name",
    label: "Nome da Empresa",
    group: "Empresa",
    type: "text",
    description: "Razão social ou nome fantasia.",
    example: "Goat Bar Coquetelaria",
  },
  {
    key: "company.cnpj",
    label: "CNPJ da Empresa",
    group: "Empresa",
    type: "text",
    description: "CNPJ cadastrado da empresa.",
    example: "00.000.000/0001-00",
  },
  {
    key: "company.phone",
    label: "Telefone Comercial",
    group: "Empresa",
    type: "text",
    description: "Telefone oficial de contato.",
    example: "(11) 98765-4321",
  },
  {
    key: "company.email",
    label: "E-mail Comercial",
    group: "Empresa",
    type: "text",
    description: "E-mail oficial para contato.",
    example: "contato@goatbar.com.br",
  },
  {
    key: "company.instagram",
    label: "Instagram",
    group: "Empresa",
    type: "text",
    description: "Perfil do Instagram oficial.",
    example: "@goatbar",
  },

  // ─── Campos Formatados / Calculados ───────────────────────
  {
    key: "computed.groom_initial",
    label: "Inicial do noivo",
    group: "Campos calculados",
    type: "text",
    description: "Inicial obtida do nome do noivo informado explicitamente no evento.",
    example: "P",
  },
  {
    key: "computed.bride_initial",
    label: "Inicial da noiva",
    group: "Campos calculados",
    type: "text",
    description: "Inicial obtida do nome da noiva informado explicitamente no evento.",
    example: "R",
  },
  {
    key: "computed.final_payment_date",
    label: "Data final para pagamento",
    group: "Campos calculados",
    type: "date",
    description: "Data do evento menos sete dias.",
    example: "2026-10-13",
  },
  {
    key: "computed.proposal_date",
    label: "Data da Proposta",
    group: "Campos Formatados / Calculados",
    type: "date",
    description: "Data em que a proposta foi gerada.",
    example: "19/08/2026",
  },
  {
    key: "computed.proposal_validity",
    label: "Validade da Proposta",
    group: "Campos Formatados / Calculados",
    type: "text",
    description: "Prazo de validade do orçamento (ex: 7 dias).",
    example: "Válido por 7 dias",
  },
  {
    key: "computed.event_date_formatted",
    label: "Data do Evento por Extenso",
    group: "Campos Formatados / Calculados",
    type: "text",
    description: "Data formatada em português brasileiro.",
    example: "20 de Outubro de 2026",
  },
  {
    key: "computed.total_value_formatted",
    label: "Valor Total Formatado (R$)",
    group: "Campos Formatados / Calculados",
    type: "text",
    description: "Valor formatado com símbolo de moeda.",
    example: "R$ 8.500,00",
  },
  {
    key: "computed.total_value_in_words",
    label: "Valor Total por Extenso",
    group: "Campos Formatados / Calculados",
    type: "text",
    description: "Valor monetário escrito por extenso.",
    example: "Oito mil e quinhentos reais",
  },
  {
    key: "computed.drinks_summary",
    label: "Resumo do Cardápio de Drinks",
    group: "Campos Formatados / Calculados",
    type: "text",
    description: "Resumo formatado das opções do bar.",
    example: "8 Drinks Clássicos e Autorais",
  },
  {
    key: "computed.welcome_drinks_summary",
    label: "Resumo de Welcome Drinks",
    group: "Campos Formatados / Calculados",
    type: "text",
    description: "Resumo dos drinks de recepção.",
    example: "Incluso Welcome Drinks (Espumante e Clericot)",
  },
  {
    key: "computed.shots_summary",
    label: "Resumo de Shots",
    group: "Campos Formatados / Calculados",
    type: "text",
    description: "Resumo dos shots de pista inclusos.",
    example: "Rodada especial de Mini Beer 43",
  },
];

// Aceito apenas para que configurações persistidas antes da separação INO/INA
// continuem salvando e resolvendo. Não integra o catálogo exibido para novos mappings.
const LEGACY_FIELD_KEYS = ["computed.couple_initials"] as const;
const VALID_FIELD_KEYS = new Set([
  ...PROPOSAL_FIELD_CATALOG.map((f) => f.key),
  ...LEGACY_FIELD_KEYS,
]);

/**
 * Validates whether a given source_field_key exists in the official catalog.
 */
export function isValidSourceFieldKey(key: string): boolean {
  return VALID_FIELD_KEYS.has(key);
}

/**
 * Retrieves a catalog item by key.
 */
export function getFieldCatalogItem(key: string): ProposalCatalogField | undefined {
  return PROPOSAL_FIELD_CATALOG.find((f) => f.key === key);
}

/**
 * Normalizes a string removing accents and special characters for comparison.
 */
function normalizeName(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Heuristic dictionary for intelligent auto-matching between Canva Data Fields and Goat Bar catalog keys.
 */
const AUTO_MATCH_ALIASES: Record<string, string[]> = {
  "event.client_name": [
    "clientname",
    "cliente",
    "nomecliente",
    "noivos",
    "nomecasal",
    "aniversariante",
    "contratante",
    "client",
  ],
  "event.event_name": ["eventname", "nomeevento", "tituloevento", "evento"],
  "computed.groom_initial": ["ino", "inicialnoivo"],
  "computed.bride_initial": ["ina", "inicialnoiva"],
  "event.event_type": ["eventtype", "tipoevento", "categoriaevento", "tipo"],
  "event.event_date": ["eventdate", "dataevento", "data", "date", "diaevento"],
  "event.event_time": ["eventtime", "horario", "hora", "horainicio", "time"],
  "event.guest_count": [
    "guestcount",
    "convidados",
    "numeroconvidados",
    "qtdconvidados",
    "guests",
    "pessoas",
    "qtdpessoas",
  ],
  "event.location": ["location", "local", "localevento", "espaco", "cidade", "endereco"],
  "event.duration_hours": ["durationhours", "duracao", "duracaobar", "horasbar", "hours"],
  "budget.total_value": [
    "totalvalue",
    "valortotal",
    "total",
    "investimento",
    "investimentototal",
    "preco",
    "valor",
  ],
  "budget.discount_value": ["discountvalue", "desconto", "valordesconto"],
  "budget.payment_terms": ["paymentterms", "formapagamento", "condicoespagamento", "pagamento"],
  "budget.beverages": ["bebidas", "beverages", "listabebidas"],
  "budget.bartenders_count": ["bartenderscount", "bartenders", "qtdbartenders"],
  "budget.bar_keepers_count": ["barkeeperscount", "barkeepers", "barback", "apoio"],
  "budget.copeiras_count": ["copeirascount", "copeiras", "qtdcopeiras"],
  "package.name": ["packagename", "nomepacote", "pacote"],
  "package.drinks_count": ["drinkscount", "qtddrinks", "totaldrinks"],
  "package.drinks_list": ["drinkslist", "drinks", "listadrinks", "cardapio", "cardapiodrinks"],
  "package.welcome_drinks": ["welcomedrinks", "recepcao", "welcome"],
  "package.shots": ["shots", "listashots", "shotspista"],
  "company.name": ["companyname", "empresa", "nomeempresa", "goatbar"],
  "company.phone": ["companyphone", "telefoneempresa", "whatsappempresa"],
  "company.instagram": ["companyinstagram", "instagram", "insta"],
  "computed.proposal_date": ["proposaldate", "dataorcamento", "dataemissao", "propostaemissao"],
  "computed.event_date_formatted": ["eventdateformatted", "dataextenso", "dataeventoextenso"],
  "computed.total_value_formatted": [
    "totalvalueformatted",
    "valortotalformatado",
    "precofromatado",
  ],
  "computed.total_value_in_words": ["totalvalueinwords", "valorextenso", "totalextenso"],
};

/**
 * Intelligent Auto-Match algorithm to suggest pairings between Canva Data Fields and Goat Bar catalog items.
 */
export function suggestAutoMatches(
  canvaFields: Array<{ key: string; name?: string; type?: string }>,
): Record<string, string> {
  const suggestions: Record<string, string> = {};

  for (const field of canvaFields) {
    const rawKey = field.key;
    const normalizedKey = normalizeName(rawKey);
    const normalizedName = field.name ? normalizeName(field.name) : "";

    let matchedCatalogKey: string | null = null;

    // 1. Direct key match (e.g. "event.client_name")
    if (VALID_FIELD_KEYS.has(rawKey)) {
      matchedCatalogKey = rawKey;
    } else {
      // 2. Exact alias match (highest priority)
      for (const [catalogKey, aliases] of Object.entries(AUTO_MATCH_ALIASES)) {
        if (aliases.some((alias) => normalizedKey === alias || normalizedName === alias)) {
          matchedCatalogKey = catalogKey;
          break;
        }
      }

      // 3. Substring match fallback (if no exact alias matched)
      if (!matchedCatalogKey) {
        for (const [catalogKey, aliases] of Object.entries(AUTO_MATCH_ALIASES)) {
          if (
            aliases.some(
              (alias) =>
                alias.length >= 4 &&
                (normalizedKey.includes(alias) || normalizedName.includes(alias)),
            )
          ) {
            matchedCatalogKey = catalogKey;
            break;
          }
        }
      }
    }

    if (matchedCatalogKey) {
      suggestions[rawKey] = matchedCatalogKey;
    }
  }

  return suggestions;
}
