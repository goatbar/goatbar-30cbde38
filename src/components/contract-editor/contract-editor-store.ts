import { useState, useCallback, useEffect, useRef } from "react";
import {
  Calendar,
  UserCheck,
  DollarSign,
  Building2,
  GlassWater,
  Sparkles,
  FileText,
} from "lucide-react";

export interface EditorFieldDef {
  key: string; // e.g. "cliente.nome"
  label: string;
  category: string;
  desc: string;
  sampleValue: string;
  defaultTag: string;
}

export interface FieldCategoryDef {
  category: string;
  icon: any;
  fields: EditorFieldDef[];
}

export const EDITOR_FIELD_CATEGORIES: FieldCategoryDef[] = [
  {
    category: "📑 Termo Aditivo", icon: FileText,
    fields: [
      { key:"contrato.data_assinatura_original",label:"Data da assinatura original",category:"Contrato",desc:"Data fully_signed_at do contrato original",sampleValue:"01/09/2026",defaultTag:"[DATA_ASSINATURA_ORIGINAL]" },
      ...[["numero","Número","1"],["data","Data","01/09/2026"],["valor_total_anterior","Total anterior","R$ 6.800,00"],["valor_total_novo","Total novo","R$ 8.000,00"],["valor_diferenca","Diferença","R$ 1.200,00"],["valor_ja_pago","Valor já pago","R$ 3.400,00"],["saldo_anterior","Saldo anterior","R$ 3.400,00"],["novo_saldo_restante","Novo saldo","R$ 4.600,00"],["credito_cliente","Crédito do cliente","R$ 0,00"],["forma_pagamento_saldo","Condição do saldo","À vista"],["meio_pagamento_saldo","Meio do saldo","PIX"],["datas_vencimento","Vencimentos","15/09/2026"],["resumo_alteracoes","Resumo das alterações","Valor total alterado"],["drinks_anteriores","Drinks anteriores","Moscow Mule"],["drinks_atuais","Drinks atuais","Fitzgerald"]].flatMap(([key,label,sample])=>[
        {key:`aditivo.${key}`,label,category:"Aditivo",desc:label,sampleValue:sample,defaultTag:`[ADITIVO_${key.toUpperCase()}]`},
        ...(["valor_total_anterior","valor_total_novo","valor_diferenca","valor_ja_pago","saldo_anterior","novo_saldo_restante","credito_cliente"].includes(key)?[{key:`aditivo.${key}_extenso`,label:`${label} por extenso`,category:"Aditivo",desc:`${label} por extenso`,sampleValue:"quatro mil e seiscentos reais",defaultTag:`[ADITIVO_${key.toUpperCase()}_EXTENSO]`}]:[]),
      ]),
    ],
  },
  {
    category: "🥂 Evento",
    icon: Calendar,
    fields: [
      { key: "evento.nome", label: "Nome do Evento", category: "Evento", desc: "Ex: Casamento Maria & Lucas", sampleValue: "Casamento Maria & Lucas", defaultTag: "[NOME_EVENTO]" },
      { key: "evento.tipo", label: "Tipo do Evento", category: "Evento", desc: "Casamento, Aniversário, Corporativo", sampleValue: "Casamento", defaultTag: "[TIPO_EVENTO]" },
      { key: "evento.data", label: "Data do Evento", category: "Evento", desc: "Data de realização (DD/MM/AAAA)", sampleValue: "15/11/2026", defaultTag: "[DATA_EVENTO]" },
      { key: "evento.hora_inicio", label: "Horário de Início", category: "Evento", desc: "Horário de início (HH:MM)", sampleValue: "19:00", defaultTag: "[HORA_INICIO]" },
      { key: "evento.hora_fim", label: "Horário de Término", category: "Evento", desc: "Horário calculado automaticamente", sampleValue: "01:00", defaultTag: "[HORA_FIM]" },
      { key: "evento.duracao_horas", label: "Duração em Horas", category: "Evento", desc: "Carga horária do evento", sampleValue: "6 horas", defaultTag: "[DURACAO_HORAS]" },
      { key: "evento.periodo_evento", label: "Período Completo", category: "Evento", desc: "Ex: 19:00 às 01:00 (com virada de dia)", sampleValue: "19:00 às 01:00", defaultTag: "[PERIODO_EVENTO]" },
      { key: "evento.local", label: "Nome do Espaço / Salão", category: "Evento", desc: "Local preenchido pelo contratante", sampleValue: "Espaço Villa Bisutti", defaultTag: "[LOCAL_EVENTO]" },
      { key: "evento.endereco_local", label: "Endereço do Local", category: "Evento", desc: "Logradouro completo do espaço", sampleValue: "Av. Morumbi, 1500", defaultTag: "[ENDERECO_LOCAL]" },
      { key: "evento.cidade", label: "Cidade", category: "Evento", desc: "Cidade da realização", sampleValue: "São Paulo", defaultTag: "[CIDADE_EVENTO]" },
      { key: "evento.convidados", label: "Número de Convidados", category: "Evento", desc: "Total de convidados", sampleValue: "150", defaultTag: "[QTD_CONVIDADOS]" },
      { key: "evento.valor_por_pessoa", label: "Valor por Pessoa (R$)", category: "Evento", desc: "Valor individual numérico em Reais", sampleValue: "R$ 45,33", defaultTag: "[VALOR_POR_PESSOA]" },
      { key: "evento.valor_por_pessoa_extenso", label: "Valor por Pessoa (Por Extenso)", category: "Evento", desc: "Valor individual escrito por extenso em português", sampleValue: "Quarenta e cinco reais e trinta e três centavos", defaultTag: "[VALOR_POR_PESSOA_EXTENSO]" },
    ],
  },
  {
    category: "👤 Cliente",
    icon: UserCheck,
    fields: [
      { key: "cliente.nome", label: "Nome Completo / Razão Social", category: "Cliente", desc: "Preenchido pelo contratante no link", sampleValue: "Maria Fernanda Oliveira", defaultTag: "[NOME_CLIENTE]" },
      { key: "cliente.documento", label: "CPF / CNPJ", category: "Cliente", desc: "Documento de identificação", sampleValue: "123.456.789-00", defaultTag: "[CPF_CLIENTE]" },
      { key: "cliente.rg", label: "RG (quando existir)", category: "Cliente", desc: "Registro Geral do contratante", sampleValue: "12.345.678-9", defaultTag: "[RG_CLIENTE]" },
      { key: "cliente.telefone", label: "Telefone de Contato", category: "Cliente", desc: "Número fixo/celular", sampleValue: "(11) 98765-4321", defaultTag: "[TELEFONE_CLIENTE]" },
      { key: "cliente.whatsapp", label: "WhatsApp", category: "Cliente", desc: "Número para WhatsApp", sampleValue: "(11) 98765-4321", defaultTag: "[WHATSAPP_CLIENTE]" },
      { key: "cliente.email", label: "E-mail de Contato", category: "Cliente", desc: "Endereço de e-mail principal", sampleValue: "maria.fernanda@email.com", defaultTag: "[EMAIL_CLIENTE]" },
      { key: "cliente.endereco", label: "Endereço Completo", category: "Cliente", desc: "Logradouro, número e bairro", sampleValue: "Av. Paulista, 1000, Apto 42", defaultTag: "[ENDERECO_CLIENTE]" },
      { key: "cliente.cep", label: "CEP", category: "Cliente", desc: "Código de Endereçamento Postal", sampleValue: "01310-100", defaultTag: "[CEP_CLIENTE]" },
      { key: "cliente.cidade", label: "Cidade", category: "Cliente", desc: "Cidade de residência", sampleValue: "São Paulo", defaultTag: "[CIDADE_CLIENTE]" },
      { key: "cliente.estado", label: "Estado (UF)", category: "Cliente", desc: "UF de residência", sampleValue: "SP", defaultTag: "[UF_CLIENTE]" },
    ],
  },
  {
    category: "💰 Financeiro",
    icon: DollarSign,
    fields: [
      { key: "financeiro.valor_total", label: "Valor Total (R$)", category: "Financeiro", desc: "Valor total numérico em Reais", sampleValue: "R$ 6.800,00", defaultTag: "[VALOR_TOTAL]" },
      { key: "financeiro.valor_total_extenso", label: "Valor Total (Por Extenso)", category: "Financeiro", desc: "Valor total por extenso em português", sampleValue: "Seis mil e oitocentos reais", defaultTag: "[VALOR_TOTAL_EXTENSO]" },
      { key: "financeiro.percentual_entrada", label: "Percentual da Entrada (%)", category: "Financeiro", desc: "Percentual numérico da entrada", sampleValue: "50%", defaultTag: "[PERCENTUAL_ENTRADA]" },
      { key: "financeiro.valor_entrada", label: "Valor da Entrada (R$)", category: "Financeiro", desc: "Valor numérico da entrada/sinal", sampleValue: "R$ 3.400,00", defaultTag: "[VALOR_ENTRADA]" },
      { key: "financeiro.valor_entrada_extenso", label: "Valor da Entrada (Por Extenso)", category: "Financeiro", desc: "Valor da entrada por extenso", sampleValue: "Três mil e quatrocentos reais", defaultTag: "[VALOR_ENTRADA_EXTENSO]" },
      { key: "financeiro.valor_restante", label: "Valor Restante (R$)", category: "Financeiro", desc: "Valor numérico restante a quitar", sampleValue: "R$ 3.400,00", defaultTag: "[VALOR_RESTANTE]" },
      { key: "financeiro.valor_restante_extenso", label: "Valor Restante (Por Extenso)", category: "Financeiro", desc: "Valor restante por extenso", sampleValue: "Três mil e quatrocentos reais", defaultTag: "[VALOR_RESTANTE_EXTENSO]" },
      { key: "financeiro.meio_pagamento", label: "Meio de Pagamento", category: "Financeiro", desc: "PIX, Transferência, Cartão ou Boleto", sampleValue: "PIX", defaultTag: "[MEIO_PAGAMENTO]" },
      { key: "financeiro.forma_pagamento", label: "Forma de Pagamento (Descrição)", category: "Financeiro", desc: "Descrição resumida das condições", sampleValue: "50% no ato + 50% até 7 dias antes", defaultTag: "[FORMA_PAGAMENTO]" },
      { key: "financeiro.clausula_pagamento", label: "Cláusula Completa de Pagamento", category: "Financeiro", desc: "Texto jurídico completo da cláusula de pagamento", sampleValue: "O CONTRATANTE pagará 50% (cinquenta por cento) do valor total no ato da assinatura...", defaultTag: "[CLAUSULA_PAGAMENTO]" },
      { key: "financeiro.data_pagamento_final", label: "Data do Pagamento Final", category: "Financeiro", desc: "Data do Evento - 7 dias", sampleValue: "08/11/2026", defaultTag: "[DATA_PAGAMENTO_FINAL]" },
    ],
  },
  {
    category: "🏢 Empresa (GOAT Bar)",
    icon: Building2,
    fields: [
      { key: "empresa.nome", label: "Nome da Empresa", category: "Empresa", desc: "Razão social da contratada", sampleValue: "GOAT BAR EVENTOS LTDA", defaultTag: "[NOME_EMPRESA]" },
      { key: "empresa.cnpj", label: "CNPJ da Empresa", category: "Empresa", desc: "Documento da GOAT Bar", sampleValue: "42.123.456/0001-99", defaultTag: "[CNPJ_EMPRESA]" },
      { key: "empresa.endereco", label: "Endereço da Empresa", category: "Empresa", desc: "Sede comercial", sampleValue: "Av. Faria Lima, 2000 - SP", defaultTag: "[ENDERECO_EMPRESA]" },
      { key: "empresa.responsavel", label: "Nome do Responsável / Sócio", category: "Empresa", desc: "Sócio representante", sampleValue: "Gabriel Santos Silva", defaultTag: "[SOCIO_GOAT]" },
      { key: "empresa.cpf_responsavel", label: "CPF do Responsável", category: "Empresa", desc: "Documento do sócio", sampleValue: "987.654.321-11", defaultTag: "[CPF_SOCIO_GOAT]" },
      { key: "empresa.cargo_responsavel", label: "Cargo do Responsável", category: "Empresa", desc: "Ex: Sócio Diretor", sampleValue: "Sócio Diretor", defaultTag: "[CARGO_SOCIO_GOAT]" },
      { key: "empresa.endereco_responsavel", label: "Endereço do Responsável", category: "Empresa", desc: "Endereço do sócio", sampleValue: "Rua Haddock Lobo, 500 - SP", defaultTag: "[ENDERECO_SOCIO_GOAT]" },
    ],
  },
  {
    category: "🍹 Cardápio & Utensílios",
    icon: GlassWater,
    fields: [
      { key: "cardapio.drinks", label: "Lista dos Drinks", category: "Cardápio", desc: "Coquetéis inclusos", sampleValue: "Gin Tônica, Moscow Mule, Penicillin, Aperol Spritz", defaultTag: "[LISTA_DRINKS]" },
      { key: "cardapio.descricao", label: "Descrição do Cardápio", category: "Cardápio", desc: "Detalhamento de insumos e marcas", sampleValue: "Insumos premium artesanais e gelo translúcido fornecido pela GOAT Bar.", defaultTag: "[DESCRICAO_BEBIDAS]" },
      { key: "cardapio.tabela_reposicao", label: "Tabela de Reposição de Copos", category: "Cardápio", desc: "Valores por unidade em caso de quebra", sampleValue: "• Taça Gin: R$ 25,00\n• Copo Baixo: R$ 18,00", defaultTag: "[TABELA_REPOSICAO]" },
    ],
  },
  {
    category: "🗓️ Geral",
    icon: Calendar,
    fields: [
      { key: "geral.data_emissao", label: "Data de Emissão", category: "Geral", desc: "Data de emissão do contrato", sampleValue: new Date().toLocaleDateString("pt-BR"), defaultTag: "[DATA_EMISSAO]" },
    ],
  },
];

export const ALL_EDITOR_FIELDS = EDITOR_FIELD_CATEGORIES.flatMap((c) => c.fields);

export interface EditorHistoryItem {
  html: string;
  name: string;
  timestamp: number;
}

export function useContractEditorStore(initialHtml: string = "", templateId?: string) {
  const [html, setHtml] = useState<string>(initialHtml);
  const [zoom, setZoom] = useState<number>(100);
  const [activeHighlightField, setActiveHighlightField] = useState<string | null>(null);
  const [isAutoSaved, setIsAutoSaved] = useState<boolean>(true);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Stack de Histórico Undo / Redo
  const historyRef = useRef<EditorHistoryItem[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [, setHistoryChangeTick] = useState<number>(0);

  // Inicializa o histórico com o HTML original
  useEffect(() => {
    if (initialHtml) {
      setHtml(initialHtml);
      historyRef.current = [{ html: initialHtml, name: "Inicial", timestamp: Date.now() }];
      historyIndexRef.current = 0;
      setHistoryChangeTick((t) => t + 1);
    }
  }, [initialHtml]);

  // Função para registrar nova alteração no histórico (Push State)
  const pushState = useCallback((newHtml: string, actionName: string = "Edição") => {
    setHtml(newHtml);
    setIsAutoSaved(false);

    // Salva rascunho em localStorage para recuperar se fechar sem querer
    if (templateId) {
      try {
        localStorage.setItem(`goat_contract_draft_${templateId}`, newHtml);
      } catch (e) {
        console.warn("Could not save local draft:", e);
      }
    }

    // Corta o histórico futuro se estivéssemos em um ponto intermediário de Undo
    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    nextHistory.push({
      html: newHtml,
      name: actionName,
      timestamp: Date.now(),
    });

    // Limita o histórico a 50 passos para preservar memória
    if (nextHistory.length > 50) {
      nextHistory.shift();
    }

    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
    setHistoryChangeTick((t) => t + 1);
  }, [templateId]);

  // Undo (CTRL + Z)
  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const prevItem = historyRef.current[historyIndexRef.current];
      setHtml(prevItem.html);
      setHistoryChangeTick((t) => t + 1);
    }
  }, []);

  // Redo (CTRL + SHIFT + Z)
  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const nextItem = historyRef.current[historyIndexRef.current];
      setHtml(nextItem.html);
      setHistoryChangeTick((t) => t + 1);
    }
  }, []);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  // Marca como salvo com sucesso
  const markSaved = useCallback(() => {
    setIsAutoSaved(true);
    setLastSavedTime(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    if (templateId) {
      localStorage.removeItem(`goat_contract_draft_${templateId}`);
    }
  }, [templateId]);

  return {
    html,
    setHtml: pushState,
    zoom,
    setZoom,
    activeHighlightField,
    setActiveHighlightField,
    isAutoSaved,
    lastSavedTime,
    undo,
    redo,
    canUndo,
    canRedo,
    markSaved,
  };
}
