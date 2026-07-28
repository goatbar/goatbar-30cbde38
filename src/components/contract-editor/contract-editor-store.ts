import { useState, useCallback, useEffect, useRef } from "react";
import {
  Calendar,
  UserCheck,
  DollarSign,
  Building2,
  GlassWater,
  Sparkles,
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
    category: "🥂 Evento",
    icon: Calendar,
    fields: [
      { key: "evento.nome", label: "Nome do Evento", category: "Evento", desc: "Ex: Casamento Maria & Lucas", sampleValue: "Casamento Maria & Lucas", defaultTag: "[NOME_EVENTO]" },
      { key: "evento.tipo", label: "Tipo do Evento", category: "Evento", desc: "Casamento, Aniversário, Corporativo", sampleValue: "Casamento", defaultTag: "[TIPO_EVENTO]" },
      { key: "evento.data", label: "Data do Evento", category: "Evento", desc: "Data de realização (DD/MM/AAAA)", sampleValue: "15/11/2026", defaultTag: "[DATA_EVENTO]" },
      { key: "evento.horario", label: "Horário de Início", category: "Evento", desc: "Horário programado", sampleValue: "19:00", defaultTag: "[HORARIO_EVENTO]" },
      { key: "evento.local", label: "Local do Evento", category: "Evento", desc: "Espaço ou salão de festas", sampleValue: "Espaço Villa Bisutti", defaultTag: "[LOCAL_EVENTO]" },
      { key: "evento.cidade", label: "Cidade", category: "Evento", desc: "Cidade da realização", sampleValue: "São Paulo", defaultTag: "[CIDADE_EVENTO]" },
      { key: "evento.convidados", label: "Número de Convidados", category: "Evento", desc: "Total de convidados", sampleValue: "150", defaultTag: "[QTD_CONVIDADOS]" },
      { key: "evento.valor_por_pessoa", label: "Valor por Pessoa", category: "Evento", desc: "Valor individual por pessoa do orçamento", sampleValue: "R$ 45,33", defaultTag: "[VALOR_POR_PESSOA]" },
    ],
  },
  {
    category: "👤 Cliente",
    icon: UserCheck,
    fields: [
      { key: "cliente.nome", label: "Nome do Cliente", category: "Cliente", desc: "Nome completo ou Razão Social", sampleValue: "Maria Fernanda Oliveira", defaultTag: "[NOME_CLIENTE]" },
      { key: "cliente.documento", label: "CPF / CNPJ", category: "Cliente", desc: "Documento do contratante", sampleValue: "123.456.789-00", defaultTag: "[CPF_CLIENTE]" },
      { key: "cliente.telefone", label: "Telefone / WhatsApp", category: "Cliente", desc: "Número para contato", sampleValue: "(11) 98765-4321", defaultTag: "[TELEFONE_CLIENTE]" },
      { key: "cliente.email", label: "E-mail de Contato", category: "Cliente", desc: "Endereço de e-mail", sampleValue: "maria.fernanda@email.com", defaultTag: "[EMAIL_CLIENTE]" },
      { key: "cliente.endereco", label: "Endereço do Cliente", category: "Cliente", desc: "Logradouro, número e bairro", sampleValue: "Av. Paulista, 1000, Apto 42 - SP", defaultTag: "[ENDERECO_CLIENTE]" },
    ],
  },
  {
    category: "💰 Financeiro",
    icon: DollarSign,
    fields: [
      { key: "financeiro.valor_total", label: "Valor do Contrato", category: "Financeiro", desc: "Valor total do orçamento", sampleValue: "R$ 6.800,00", defaultTag: "[VALOR_TOTAL]" },
      { key: "financeiro.valor_entrada", label: "Valor da Entrada", category: "Financeiro", desc: "Valor do sinal/entrada", sampleValue: "R$ 3.400,00", defaultTag: "[VALOR_ENTRADA]" },
      { key: "financeiro.saldo_restante", label: "Saldo Restante", category: "Financeiro", desc: "Valor a quitar", sampleValue: "R$ 3.400,00", defaultTag: "[SALDO_RESTANTE]" },
      { key: "financeiro.forma_pagamento", label: "Forma de Pagamento", category: "Financeiro", desc: "Condições de parcelamento", sampleValue: "50% no ato + 50% até 5 dias antes", defaultTag: "[FORMA_PAGAMENTO]" },
      { key: "financeiro.data_vencimento", label: "Data de Vencimento", category: "Financeiro", desc: "Data limite para quitação", sampleValue: "10/11/2026", defaultTag: "[DATA_VENCIMENTO]" },
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
