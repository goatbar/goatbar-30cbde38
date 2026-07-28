/**
 * TemplateFieldEditor.tsx
 *
 * Editor visual executivo drag-and-drop para mapeamento de campos dinâmicos (Match de Campos)
 * sobre as páginas PDF de um modelo de proposta comercial.
 *
 * Recursos Executivos:
 *  1. Renderização fiel de PDF via pdfjs-dist
 *  2. Destaque e sincronização bidirecional entre Canvas e Sidebar
 *  3. Alternância instantânea em tempo real entre "Placeholders" e "Dados Reais"
 *  4. Auto Save inteligente e tratamento de erros sem [object Object] (Código: MATCH_SAVE_001)
 *  5. Painel de Diagnóstico Técnico e Validação
 *  6. Controles de Zoom, Alinhamento Inteligente, Duplicação e Bloqueio de Campos
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type MouseEvent as RMouseEvent,
} from "react";
import * as pdfjs from "pdfjs-dist";
import {
  Plus,
  Trash2,
  Save,
  FlaskConical,
  Eye,
  Download,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Move,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Copy,
  Lock,
  Unlock,
  EyeOff,
  Activity,
  CheckCircle2,
  AlertTriangle,
  FileCode,
} from "lucide-react";
import { proposalTemplatesService } from "@/services/proposal-service";
import { pdfGenerationService } from "@/services/proposal-service";
import type { ProposalTemplate } from "@/services/proposal-service";
import type {
  ProposalTemplateField,
  TemplateFieldType,
  FieldAlign,
  FieldWeight,
} from "@/lib/proposal-template-mapper";
import { TEMPLATE_FIELD_KEYS } from "@/lib/proposal-template-mapper";

// ─── PDF.js worker ──────────────────────────────────────────────
pdfjs.GlobalWorkerOptions.workerSrc =
  "https://unpkg.com/pdfjs-dist@5.7.284/build/pdf.worker.min.mjs";

// ─── Constants ──────────────────────────────────────────────────
const BRAND_COLORS = [
  { label: "Vermelho GOAT", value: "#701117" },
  { label: "Creme", value: "#f7f4ef" },
  { label: "Escuro", value: "#0f1414" },
  { label: "Dourado Premium", value: "#d4af37" },
];

const FIELD_TYPE_LABELS: Record<TemplateFieldType, string> = {
  texto_simples: "Texto Simples",
  texto_multiline: "Texto Multiline",
  lista_dinamica: "Lista Dinâmica",
  moeda: "Moeda (R$)",
  data: "Data",
  numero: "Número",
  texto_arco: "Texto em Arco",
  imagem_dinamica: "Imagem Dinâmica",
};

const FIELD_KEY_LABELS: Record<string, string> = {
  data_orcamento: "Data do Orçamento",
  tipo_evento: "Tipo de Evento",
  nome_evento: "Nome do Evento",
  nome_cliente: "Nome do Cliente",
  nome_casal: "Nome do Casal",
  data_evento: "Data do Evento",
  lista_drinks: "Lista de Drinks",
  lista_bebidas: "Lista de Bebidas",
  numero_convidados: "Nº de Convidados",
  quantidade_bartenders: "Qtd. Bartenders",
  quantidade_bar_keeper: "Qtd. Bar Keeper",
  quantidade_copeira: "Qtd. Copeira",
  quantidade_drinks: "Qtd. Drinks",
  investimento_total: "Investimento Total",
  forma_pagamento: "Forma de Pagamento",
  inicial_1: "Inicial do Noivo(a) 1",
  inicial_2: "Inicial do Noivo(a) 2",
};

// Dados de Exemplo para Testar Preenchimento e Alternância em Tempo Real
const MOCK_DATA: Record<string, string> = {
  data_orcamento: "26/05/2026",
  tipo_evento: "CASAMENTO",
  nome_evento: "Casamento Maria & Lucas",
  nome_cliente: "Maria & Lucas",
  nome_casal: "Maria & Lucas",
  data_evento: "14/12/2026",
  lista_drinks: "Gin Tônica\nAperol Spritz\nMojito\nNegroni",
  lista_bebidas: "Vinho Branco\nCerveja Artesanal\nSucos Naturais",
  numero_convidados: "150 convidados",
  quantidade_bartenders: "3 Bartenders",
  quantidade_bar_keeper: "2 Bar Keepers",
  quantidade_copeira: "2 Copeiras",
  quantidade_drinks: "12 variedades de drinks",
  investimento_total: "R$ 18.500,00",
  forma_pagamento: "30% no ato da assinatura + 70% até 7 dias antes do evento",
  inicial_1: "M",
  inicial_2: "L",
};

function extractErrorMessage(err: any): { message: string; code: string; details?: string } {
  if (!err) return { message: "Erro desconhecido no sistema.", code: "MATCH_SAVE_001" };
  if (typeof err === "string") return { message: err, code: "MATCH_SAVE_001" };
  if (err instanceof Error) return { message: err.message, code: "MATCH_SAVE_001", details: err.stack };
  if (typeof err === "object") {
    const msg = err.message || err.error_description || err.details || err.hint || JSON.stringify(err, null, 2);
    return { message: msg, code: err.code || "MATCH_SAVE_001", details: err.details };
  }
  return { message: String(err), code: "MATCH_SAVE_001" };
}

function makeDefaultField(templateId: string, pageNumber: number): ProposalTemplateField {
  return {
    template_id: templateId,
    page_number: pageNumber,
    field_key: "data_orcamento",
    field_label: "Data do Orçamento",
    field_type: "texto_simples",
    x: 0.1,
    y: 0.1,
    width: 0.3,
    height: 0.06,
    font_family: "Neue Montreal",
    font_size: 16,
    font_color: "#f7f4ef",
    font_weight: "normal",
    text_align: "left",
    line_height: 1.4,
    letter_spacing: 0,
    z_index: 1,
    is_locked: false,
    is_hidden: false,
    config: {},
  };
}

// ─── ArcPreviewSVG ───────────────────────────────────────────────
function ArcPreviewSVG({
  field,
  boxW,
  boxH,
  canvasW,
  canvasH,
  displayText,
}: {
  field: ProposalTemplateField;
  boxW: number;
  boxH: number;
  canvasW: number;
  canvasH: number;
  displayText?: string;
}) {
  const cfg = field.config as {
    startAngle?: number;
    endAngle?: number;
    direction?: string;
    uppercase?: boolean;
    arcPosition?: string;
    radius?: number;
  };

  const radius = cfg.radius && cfg.radius > 0
    ? cfg.radius * Math.min(canvasW, canvasH)
    : Math.max(10, Math.min(boxW, boxH) / 2 - 16);
  const cx = boxW / 2;
  const cy = boxH / 2;
  const isBottom = cfg.arcPosition === "bottom";

  const startDeg = Number.isFinite(cfg.startAngle) ? (cfg.startAngle as number) : (isBottom ? 170 : 200);
  const endDeg = Number.isFinite(cfg.endAngle) ? (cfg.endAngle as number) : (isBottom ? 10 : 340);

  const sampleText = (
    displayText || (cfg.uppercase ? field.field_label.toUpperCase() : field.field_label)
  ).slice(0, 35);

  const startRad = (startDeg * Math.PI) / 180;
  const endRad = (endDeg * Math.PI) / 180;
  const arcId = `arc-${field.id ?? Math.random().toString(36).slice(2)}`;

  const x1 = cx + radius * Math.cos(startRad);
  const y1 = cy + radius * Math.sin(startRad);
  const x2 = cx + radius * Math.cos(endRad);
  const y2 = cy + radius * Math.sin(endRad);
  const spanDeg = Math.abs(startDeg - endDeg);
  const largeArc = spanDeg > 180 ? 1 : 0;
  const sweep = isBottom ? 0 : 1;

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: boxW,
        height: boxH,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      <defs>
        <path id={arcId} d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${x2} ${y2}`} />
      </defs>
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={field.font_color}
        strokeWidth={1}
        strokeDasharray="4 4"
        opacity={0.4}
      />
      <text
        fontFamily={field.font_family}
        fontSize={field.font_size}
        fontWeight={field.font_weight}
        fill={field.font_color}
        letterSpacing={field.letter_spacing}
      >
        <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
          {sampleText}
        </textPath>
      </text>
    </svg>
  );
}

// ─── PDFPageCanvas ────────────────────────────────────────────────
function PDFPageCanvas({
  pdfDoc,
  pageIndex,
  onDimensionsReady,
  scale = 1,
}: {
  pdfDoc: pdfjs.PDFDocumentProxy | null;
  pageIndex: number;
  onDimensionsReady?: (w: number, h: number) => void;
  scale?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const page = await pdfDoc.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) {
          setLoading(false);
          onDimensionsReady?.(viewport.width, viewport.height);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageIndex, scale, onDimensionsReady]);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(15,20,20,0.7)",
            borderRadius: 8,
          }}
        >
          <Loader2 className="animate-spin" style={{ color: "#f7f4ef", width: 32, height: 32 }} />
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: "block", borderRadius: 4 }} />
    </div>
  );
}

// ─── FieldBox ─────────────────────────────────────────────────────
function FieldBox({
  field,
  canvasW,
  canvasH,
  isSelected,
  showRealData,
  onSelect,
  onChange,
}: {
  field: ProposalTemplateField;
  canvasW: number;
  canvasH: number;
  isSelected: boolean;
  showRealData: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<ProposalTemplateField>) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ mx: number; my: number; x: number; y: number } | null>(null);
  const resizeStartRef = useRef<{ mx: number; my: number; w: number; h: number } | null>(null);

  if (field.is_hidden) return null;

  const px = field.x * canvasW;
  const py = field.y * canvasH;
  const pw = field.width * canvasW;
  const ph = field.height * canvasH;

  // Drag handlers
  const onDragMouseDown = (e: RMouseEvent) => {
    if (field.is_locked) {
      onSelect();
      return;
    }
    e.stopPropagation();
    onSelect();
    dragStartRef.current = { mx: e.clientX, my: e.clientY, x: field.x, y: field.y };

    const onMove = (ev: globalThis.MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = (ev.clientX - dragStartRef.current.mx) / canvasW;
      const dy = (ev.clientY - dragStartRef.current.my) / canvasH;
      onChange({
        x: Math.min(1 - field.width, Math.max(0, dragStartRef.current.x + dx)),
        y: Math.min(1 - field.height, Math.max(0, dragStartRef.current.y + dy)),
      });
    };
    const onUp = () => {
      dragStartRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Resize handlers
  const onResizeMouseDown = (e: RMouseEvent) => {
    if (field.is_locked) return;
    e.stopPropagation();
    resizeStartRef.current = { mx: e.clientX, my: e.clientY, w: field.width, h: field.height };

    const onMove = (ev: globalThis.MouseEvent) => {
      if (!resizeStartRef.current) return;
      const dw = (ev.clientX - resizeStartRef.current.mx) / canvasW;
      const dh = (ev.clientY - resizeStartRef.current.my) / canvasH;
      onChange({
        width: Math.min(1 - field.x, Math.max(0.05, resizeStartRef.current.w + dw)),
        height: Math.min(1 - field.y, Math.max(0.02, resizeStartRef.current.h + dh)),
      });
    };
    const onUp = () => {
      resizeStartRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const realValue = MOCK_DATA[field.field_key] || field.field_label;
  const rawText = showRealData ? realValue : field.field_label;

  const previewText =
    field.field_type === "texto_arco"
      ? null
      : field.config?.uppercase
      ? rawText.toUpperCase()
      : rawText;

  return (
    <div
      ref={boxRef}
      onMouseDown={onDragMouseDown}
      style={{
        position: "absolute",
        left: px,
        top: py,
        width: pw,
        height: ph,
        border: isSelected
          ? "2px solid #701117"
          : showRealData
          ? "1.5px solid rgba(212,175,55,0.8)"
          : "1.5px dashed rgba(247,244,239,0.5)",
        background: isSelected
          ? "rgba(112,17,23,0.18)"
          : showRealData
          ? "rgba(212,175,55,0.08)"
          : "rgba(247,244,239,0.06)",
        cursor: field.is_locked ? "pointer" : "move",
        borderRadius: 4,
        zIndex: field.z_index,
        userSelect: "none",
        boxSizing: "border-box",
        overflow: "visible",
        display: "flex",
        alignItems: "flex-start",
        padding: "2px 4px",
        boxShadow: isSelected ? "0 0 12px rgba(112,17,23,0.6)" : "none",
      }}
    >
      {/* Text preview */}
      {previewText && (
        <span
          style={{
            fontFamily: `"${field.font_family}", sans-serif`,
            fontSize: field.font_size,
            color: field.font_color,
            fontWeight: field.font_weight === "bold" ? 700 : 400,
            textAlign: field.text_align as any,
            lineHeight: field.line_height,
            letterSpacing: field.letter_spacing,
            whiteSpace: ["texto_multiline", "lista_dinamica"].includes(field.field_type) ? "pre-wrap" : "nowrap",
            overflow: "visible",
            width: "100%",
          }}
        >
          {previewText}
        </span>
      )}

      {/* Arc text preview */}
      {field.field_type === "texto_arco" && (
        <ArcPreviewSVG
          field={field}
          boxW={pw}
          boxH={ph}
          canvasW={canvasW}
          canvasH={canvasH}
          displayText={showRealData ? realValue : undefined}
        />
      )}

      {/* Badge identificadora */}
      <span
        style={{
          position: "absolute",
          bottom: 2,
          right: 18,
          fontSize: 9,
          background: isSelected ? "#701117" : "#0f1414",
          color: "#f7f4ef",
          padding: "1px 4px",
          borderRadius: 3,
          fontFamily: "sans-serif",
          pointerEvents: "none",
          border: "1px solid rgba(247,244,239,0.2)",
        }}
      >
        {field.field_key} {field.is_locked ? "🔒" : ""}
      </span>

      {/* Resize handle */}
      {!field.is_locked && (
        <div
          onMouseDown={onResizeMouseDown}
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 12,
            height: 12,
            cursor: "nwse-resize",
            background: isSelected ? "#701117" : "rgba(247,244,239,0.4)",
            borderRadius: "2px 0 2px 0",
          }}
        />
      )}
    </div>
  );
}

// ─── ColorPicker ────────────────────────────────────────────────
function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      {BRAND_COLORS.map((c) => (
        <button
          key={c.value}
          title={c.label}
          onClick={() => onChange(c.value)}
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: c.value,
            border: value === c.value ? "3px solid #f7f4ef" : "2px solid rgba(247,244,239,0.25)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title="Cor personalizada"
        style={{
          width: 28,
          height: 24,
          border: "none",
          padding: 0,
          cursor: "pointer",
          background: "transparent",
          borderRadius: 4,
        }}
      />
      <span style={{ fontFamily: "monospace", fontSize: 11, color: "#a0a0a0" }}>{value}</span>
    </div>
  );
}

// ─── ArcConfig ──────────────────────────────────────────────────
function ArcConfig({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (cfg: Record<string, unknown>) => void;
}) {
  const cfg = config as {
    radius?: number;
    startAngle?: number;
    endAngle?: number;
    arcPosition?: string;
  };

  const set = (key: string, val: unknown) => onChange({ ...config, [key]: val });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <button
          type="button"
          onClick={() => { set("arcPosition", "top"); set("startAngle", 200); set("endAngle", 340); }}
          style={{
            width: "100%", padding: "8px 12px", borderRadius: 6, cursor: "pointer",
            fontSize: 12, fontWeight: 600, textAlign: "left", display: "flex", alignItems: "center", gap: 8,
            background: cfg.arcPosition !== "bottom" ? "#701117" : "rgba(247,244,239,0.06)",
            color: "#f7f4ef", border: `1px solid ${cfg.arcPosition !== "bottom" ? "#8b1a22" : "rgba(247,244,239,0.12)"}`,
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>⌢</span>
          <span>Arco Superior</span>
          <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.6 }}>200° → 340°</span>
        </button>
        <button
          type="button"
          onClick={() => { set("arcPosition", "bottom"); set("startAngle", 170); set("endAngle", 10); }}
          style={{
            width: "100%", padding: "8px 12px", borderRadius: 6, cursor: "pointer",
            fontSize: 12, fontWeight: 600, textAlign: "left", display: "flex", alignItems: "center", gap: 8,
            background: cfg.arcPosition === "bottom" ? "#701117" : "rgba(247,244,239,0.06)",
            color: "#f7f4ef", border: `1px solid ${cfg.arcPosition === "bottom" ? "#8b1a22" : "rgba(247,244,239,0.12)"}`,
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>⌣</span>
          <span>Arco Inferior</span>
          <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.6 }}>170° → 10°</span>
        </button>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 10, color: "#a0a0a0" }}>Raio do Arco (%)</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="range"
            min={5}
            max={100}
            step={1}
            value={Math.round((cfg.radius ?? 0.15) * 100)}
            onChange={(e) => set("radius", parseFloat(e.target.value) / 100)}
            style={{ flex: 1, accentColor: "#701117" }}
          />
          <span style={{ color: "#f7f4ef", fontSize: 12, minWidth: 28, textAlign: "right" }}>
            {Math.round((cfg.radius ?? 0.15) * 100)}%
          </span>
        </div>
      </label>
    </div>
  );
}

// ─── FieldPropertiesPanel ────────────────────────────────────────
function FieldPropertiesPanel({
  field,
  onUpdate,
  onDuplicate,
  onDelete,
}: {
  field: ProposalTemplateField;
  onUpdate: (patch: Partial<ProposalTemplateField>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const labelStyle: React.CSSProperties = { fontSize: 10, color: "#a0a0a0", display: "block", marginBottom: 3 };
  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(247,244,239,0.08)", border: "1px solid rgba(247,244,239,0.15)",
    borderRadius: 6, padding: "5px 8px", color: "#f7f4ef", fontSize: 12, boxSizing: "border-box",
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: "#701117", textTransform: "uppercase", letterSpacing: 1,
    margin: "10px 0 6px", borderBottom: "1px solid rgba(112,17,23,0.3)", paddingBottom: 4,
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 24px", display: "flex", flexDirection: "column", gap: 6 }}>
      {/* Ações de Campo (Bloquear / Duplicar) */}
      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
        <button
          onClick={() => onUpdate({ is_locked: !field.is_locked })}
          style={{
            flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer",
            background: field.is_locked ? "#701117" : "rgba(247,244,239,0.08)",
            border: "1px solid rgba(247,244,239,0.15)", color: "#f7f4ef", fontSize: 11, fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          }}
        >
          {field.is_locked ? <Lock size={12} /> : <Unlock size={12} />}
          <span>{field.is_locked ? "Bloqueado" : "Bloquear"}</span>
        </button>
        <button
          onClick={onDuplicate}
          style={{
            flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer",
            background: "rgba(247,244,239,0.08)", border: "1px solid rgba(247,244,239,0.15)",
            color: "#f7f4ef", fontSize: 11, fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          }}
        >
          <Copy size={12} /> Duplicar
        </button>
      </div>

      <p style={sectionTitle}>Campo</p>

      <label>
        <span style={labelStyle}>Tipo de dado</span>
        <select
          value={field.field_key}
          onChange={(e) => onUpdate({ field_key: e.target.value, field_label: FIELD_KEY_LABELS[e.target.value] ?? e.target.value })}
          style={inputStyle}
        >
          {TEMPLATE_FIELD_KEYS.map((k) => (
            <option key={k} value={k}>{FIELD_KEY_LABELS[k] ?? k}</option>
          ))}
        </select>
      </label>

      <label>
        <span style={labelStyle}>Tipo de renderização</span>
        <select
          value={field.field_type}
          onChange={(e) => onUpdate({ field_type: e.target.value as TemplateFieldType })}
          style={inputStyle}
        >
          {Object.entries(FIELD_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </label>

      <label>
        <span style={labelStyle}>Página (base 0)</span>
        <input
          type="number" min={0} value={field.page_number}
          onChange={(e) => onUpdate({ page_number: parseInt(e.target.value) })}
          style={inputStyle}
        />
      </label>

      <p style={sectionTitle}>Posição & Tamanho</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {(["x", "y", "width", "height"] as const).map((k) => (
          <label key={k}>
            <span style={labelStyle}>{k.toUpperCase()} (0–1)</span>
            <input
              type="number" min={0} max={1} step={0.001} value={field[k]}
              onChange={(e) => onUpdate({ [k]: parseFloat(e.target.value) })}
              style={inputStyle}
            />
          </label>
        ))}
      </div>

      <p style={sectionTitle}>Tipografia</p>

      <label>
        <span style={labelStyle}>Tamanho da fonte (px)</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="range" min={6} max={120} value={field.font_size}
            onChange={(e) => onUpdate({ font_size: parseInt(e.target.value) })}
            style={{ flex: 1, accentColor: "#701117" }}
          />
          <span style={{ color: "#f7f4ef", fontSize: 13, minWidth: 28 }}>{field.font_size}</span>
        </div>
      </label>

      <label>
        <span style={labelStyle}>Cor do texto</span>
        <ColorPicker value={field.font_color} onChange={(c) => onUpdate({ font_color: c })} />
      </label>

      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button
          onClick={() => onUpdate({ font_weight: field.font_weight === "bold" ? "normal" : "bold" })}
          title="Negrito"
          style={{
            width: 34, height: 30, borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            background: field.font_weight === "bold" ? "#701117" : "rgba(247,244,239,0.08)",
            border: "1px solid rgba(112,17,23,0.4)", color: "#f7f4ef",
          }}
        >
          <Bold size={14} />
        </button>
        {(["left", "center", "right"] as FieldAlign[]).map((a) => (
          <button
            key={a}
            onClick={() => onUpdate({ text_align: a })}
            title={a}
            style={{
              width: 34, height: 30, borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              background: field.text_align === a ? "#701117" : "rgba(247,244,239,0.08)",
              border: "1px solid rgba(112,17,23,0.4)", color: "#f7f4ef",
            }}
          >
            {a === "left" ? <AlignLeft size={14} /> : a === "center" ? <AlignCenter size={14} /> : <AlignRight size={14} />}
          </button>
        ))}
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginTop: 8 }}>
        <input
          type="checkbox"
          checked={!!(field.config as any)?.uppercase}
          onChange={(e) => onUpdate({ config: { ...(field.config as any), uppercase: e.target.checked } })}
          style={{ accentColor: "#701117" }}
        />
        <span style={{ fontSize: 12, color: "#f7f4ef" }}>Transformar em MAIÚSCULO</span>
      </label>

      {field.field_type === "texto_arco" && (
        <>
          <p style={sectionTitle}>Configuração do Arco</p>
          <ArcConfig
            config={field.config as Record<string, unknown>}
            onChange={(cfg) => onUpdate({ config: cfg as any })}
          />
        </>
      )}

      <div style={{ marginTop: 16 }}>
        <button
          onClick={onDelete}
          style={{
            width: "100%", padding: "8px 0", borderRadius: 6, background: "rgba(112,17,23,0.15)",
            border: "1px solid rgba(112,17,23,0.4)", color: "#f97b7b", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, fontWeight: 600,
          }}
        >
          <Trash2 size={14} /> Excluir Campo
        </button>
      </div>
    </div>
  );
}

// ─── TestFillModal ───────────────────────────────────────────────
function TestFillModal({
  fields,
  templateUrl,
  onClose,
}: {
  fields: ProposalTemplateField[];
  templateUrl: string | null;
  onClose: () => void;
}) {
  const [testData, setTestData] = useState<Record<string, string>>({ ...MOCK_DATA });
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const usedKeys = [...new Set(fields.map((f) => f.field_key))];

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const proposalData = {
        proposalDate: testData.data_orcamento ?? "",
        eventDate: testData.data_evento ?? "",
        clientName: testData.nome_cliente ?? testData.nome_casal ?? "",
        eventTypeLabel: testData.tipo_evento ?? "",
        selectedDrinks: (testData.lista_drinks ?? "").split("\n").filter(Boolean),
        includedBeverages: (testData.lista_bebidas ?? "").split("\n").filter(Boolean),
        guests: parseInt(testData.numero_convidados ?? "0") || 0,
        bartenders: parseInt(testData.quantidade_bartenders ?? "0") || 0,
        keepers: parseInt(testData.quantidade_bar_keeper ?? "0") || 0,
        copeiras: parseInt(testData.quantidade_copeira ?? "0") || 0,
        totalDrinkVarieties: parseInt(testData.quantidade_drinks ?? "0") || 0,
        finalInvestment: parseFloat((testData.investimento_total ?? "0").replace(/[^0-9,]/g, "").replace(",", ".")) || 0,
        paymentTerms: testData.forma_pagamento ?? "",
        includedServices: [],
      };

      const bytes = await pdfGenerationService.generateProposalPDF(
        templateUrl,
        proposalData,
        "casamento",
        fields
      );
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
    } catch (e: any) {
      console.error(e);
      const errInfo = extractErrorMessage(e);
      alert(`Erro ao gerar prévia:\n${errInfo.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(15,20,20,0.92)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyBetween: "space-between", padding: "14px 20px", borderBottom: "1px solid rgba(247,244,239,0.1)" }}>
        <h3 style={{ color: "#f7f4ef", fontFamily: "'Neue Montreal', sans-serif", fontSize: 16, fontWeight: 700, margin: 0 }}>
          🧪 Testar Preenchimento da Proposta
        </h3>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#f7f4ef", cursor: "pointer", marginLeft: "auto" }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ width: 320, padding: 16, overflowY: "auto", borderRight: "1px solid rgba(247,244,239,0.1)", display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ color: "#a0a0a0", fontSize: 11, margin: "0 0 6px" }}>Preencha os dados fictícios para validar o mapeamento:</p>
          {usedKeys.map((key) => (
            <label key={key} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 11, color: "#a0a0a0" }}>{FIELD_KEY_LABELS[key] ?? key}</span>
              {key.startsWith("lista_") || key === "forma_pagamento" ? (
                <textarea
                  value={testData[key] ?? ""}
                  onChange={(e) => setTestData((p) => ({ ...p, [key]: e.target.value }))}
                  rows={3}
                  style={{
                    background: "rgba(247,244,239,0.08)", border: "1px solid rgba(247,244,239,0.15)",
                    borderRadius: 6, padding: "5px 8px", color: "#f7f4ef", fontSize: 12, resize: "vertical",
                  }}
                />
              ) : (
                <input
                  type="text"
                  value={testData[key] ?? ""}
                  onChange={(e) => setTestData((p) => ({ ...p, [key]: e.target.value }))}
                  style={{
                    background: "rgba(247,244,239,0.08)", border: "1px solid rgba(247,244,239,0.15)",
                    borderRadius: 6, padding: "5px 8px", color: "#f7f4ef", fontSize: 12,
                  }}
                />
              )}
            </label>
          ))}
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              marginTop: 8, padding: "10px 0", borderRadius: 8, cursor: generating ? "not-allowed" : "pointer",
              background: "#701117", border: "none", color: "#f7f4ef", fontWeight: 700, fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {generating ? <><Loader2 size={14} className="animate-spin" /> Gerando...</> : <><Eye size={14} /> Gerar Prévia</>}
          </button>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#1a1a1a" }}>
          {previewUrl ? (
            <iframe src={previewUrl} style={{ width: "100%", height: "100%", border: "none" }} title="Prévia PDF" />
          ) : (
            <div style={{ textAlign: "center", color: "#a0a0a0" }}>
              <Eye size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p style={{ fontSize: 13 }}>Preencha os dados e clique em "Gerar Prévia"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main TemplateFieldEditor ────────────────────────────────────
export function TemplateFieldEditor({
  template,
  onClose,
}: {
  template: ProposalTemplate;
  onClose: () => void;
}) {
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 500 });
  const [fields, setFields] = useState<ProposalTemplateField[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showRealData, setShowRealData] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [errorModal, setErrorModal] = useState<{ message: string; code: string; details?: string } | null>(null);

  // Load PDF
  useEffect(() => {
    if (!template.file_url) { setLoadingPdf(false); return; }
    setLoadingPdf(true);
    const task = pdfjs.getDocument({ url: template.file_url, withCredentials: false });
    task.promise.then((doc) => {
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setLoadingPdf(false);
    }).catch((e) => {
      console.error("PDF load error:", e);
      setLoadingPdf(false);
    });
    return () => { task.destroy(); };
  }, [template.file_url]);

  // Load saved fields
  useEffect(() => {
    proposalTemplatesService.listTemplateFields(template.id).then((data) => {
      setFields(data.map((f) => ({ ...f, id: f.id ?? Math.random().toString(36) })));
    }).catch(console.error);
  }, [template.id]);

  const handleDimensionsReady = useCallback((w: number, h: number) => {
    setCanvasSize({ w, h });
  }, []);

  const addField = () => {
    const newId = `new-${Date.now()}`;
    const f = makeDefaultField(template.id, currentPage);
    (f as any).id = newId;
    setFields((prev) => [...prev, f as ProposalTemplateField]);
    setSelectedId(newId);
  };

  const updateField = (id: string, patch: Partial<ProposalTemplateField>) => {
    setFields((prev) => prev.map((f) => ((f as any).id === id ? { ...f, ...patch } : f)));
  };

  const duplicateField = (id: string) => {
    const target = fields.find((f) => (f as any).id === id);
    if (!target) return;
    const newId = `dup-${Date.now()}`;
    const dup: ProposalTemplateField = {
      ...target,
      id: newId,
      x: Math.min(0.8, target.x + 0.03),
      y: Math.min(0.8, target.y + 0.03),
    };
    setFields((prev) => [...prev, dup]);
    setSelectedId(newId);
  };

  const deleteField = (id: string) => {
    setFields((prev) => prev.filter((f) => (f as any).id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const saveMapping = async () => {
    setSaving(true);
    try {
      const saved = await proposalTemplatesService.replaceTemplateFields(template.id, fields);
      setFields(saved.map((f) => ({ ...f, id: f.id ?? Math.random().toString(36) })));
    } catch (e: any) {
      console.error("Erro completo ao salvar mapeamento:", e);
      const errInfo = extractErrorMessage(e);
      setErrorModal(errInfo);
    } finally {
      setSaving(false);
    }
  };

  const selectedField = fields.find((f) => (f as any).id === selectedId) ?? null;
  const pageFields = fields.filter((f) => f.page_number === currentPage);

  // Diagnóstico
  const totalFields = fields.length;
  const duplicatedKeys = [...new Set(fields.map((f) => f.field_key).filter((k, i, a) => a.indexOf(k) !== i))];
  const pagesWithFields = [...new Set(fields.map((f) => f.page_number))].sort((a, b) => a - b);

  const btnBase: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8,
    cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'Neue Montreal', sans-serif",
    border: "none", color: "#f7f4ef", transition: "opacity 0.15s",
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column",
        background: "#0f1414", fontFamily: "'Neue Montreal', sans-serif",
      }}
      onClick={() => setSelectedId(null)}
    >
      {/* ─── TOOLBAR ─────────────────────────────────────────── */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
          borderBottom: "1px solid rgba(247,244,239,0.1)", background: "rgba(15,20,20,0.98)",
          flexWrap: "wrap",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} style={{ ...btnBase, background: "rgba(247,244,239,0.06)", border: "1px solid rgba(247,244,239,0.12)" }}>
          <X size={14} /> Fechar
        </button>

        <div style={{ height: 28, width: 1, background: "rgba(247,244,239,0.12)" }} />

        {/* Navegação de Páginas */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            style={{ ...btnBase, background: "rgba(247,244,239,0.06)", border: "1px solid rgba(247,244,239,0.12)", padding: "7px 10px", opacity: currentPage === 0 ? 0.4 : 1 }}
          >
            <ChevronLeft size={14} />
          </button>
          <span style={{ color: "#f7f4ef", fontSize: 13, minWidth: 70, textAlign: "center" }}>
            Página {currentPage + 1} / {numPages || "—"}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(numPages - 1, p + 1))}
            disabled={currentPage >= numPages - 1}
            style={{ ...btnBase, background: "rgba(247,244,239,0.06)", border: "1px solid rgba(247,244,239,0.12)", padding: "7px 10px", opacity: currentPage >= numPages - 1 ? 0.4 : 1 }}
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <div style={{ height: 28, width: 1, background: "rgba(247,244,239,0.12)" }} />

        {/* Zoom */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(247,244,239,0.06)", padding: "2px 8px", borderRadius: 8 }}>
          <button onClick={() => setZoom((z) => Math.max(50, z - 25))} style={{ background: "none", border: "none", color: "#f7f4ef", cursor: "pointer" }}>
            <ZoomOut size={14} />
          </button>
          <span style={{ color: "#f7f4ef", fontSize: 12, fontWeight: 700, minWidth: 36, textAlign: "center" }}>{zoom}%</span>
          <button onClick={() => setZoom((z) => Math.min(200, z + 25))} style={{ background: "none", border: "none", color: "#f7f4ef", cursor: "pointer" }}>
            <ZoomIn size={14} />
          </button>
        </div>

        <div style={{ height: 28, width: 1, background: "rgba(247,244,239,0.12)" }} />

        {/* Adicionar Campo */}
        <button onClick={(e) => { e.stopPropagation(); addField(); }} style={{ ...btnBase, background: "#701117" }}>
          <Plus size={14} /> Adicionar Campo
        </button>

        {/* Salvar Mapeamento */}
        <button
          onClick={(e) => { e.stopPropagation(); saveMapping(); }}
          disabled={saving}
          style={{ ...btnBase, background: saving ? "rgba(112,17,23,0.4)" : "#701117", border: "2px solid #701117" }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? "Salvar..." : "Salvar Mapeamento"}
        </button>

        {/* Alternar Placeholders / Dados Reais em Tempo Real */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowRealData((v) => !v); }}
          style={{
            ...btnBase,
            background: showRealData ? "#d4af37" : "rgba(247,244,239,0.06)",
            color: showRealData ? "#0f1414" : "#f7f4ef",
            border: showRealData ? "2px solid #d4af37" : "1px solid rgba(247,244,239,0.12)",
          }}
        >
          <Eye size={14} />
          {showRealData ? "Ver Placeholders" : "Ver Dados Reais"}
        </button>

        {/* Diagnóstico */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowDiagnostics((v) => !v); }}
          style={{ ...btnBase, background: "rgba(247,244,239,0.06)", border: "1px solid rgba(247,244,239,0.12)" }}
        >
          <Activity size={14} /> Diagnóstico
        </button>

        {/* Testar Preenchimento */}
        <button onClick={(e) => { e.stopPropagation(); setShowTestModal(true); }} style={{ ...btnBase, background: "rgba(247,244,239,0.06)", border: "1px solid rgba(247,244,239,0.12)" }}>
          <FlaskConical size={14} /> Testar Preenchimento
        </button>

        <div style={{ marginLeft: "auto", color: "#a0a0a0", fontSize: 11 }}>
          {totalFields} campo(s) mapeado(s) · {template.name}
        </div>
      </div>

      {/* ─── MAIN CONTENT ────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Canvas area com Escala de Zoom */}
        <div
          style={{ flex: 1, overflow: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 24, background: "#1a1e1e" }}
          onClick={(e) => e.stopPropagation()}
        >
          {loadingPdf ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 400, color: "#f7f4ef", gap: 12 }}>
              <Loader2 className="animate-spin" size={32} />
              <p style={{ fontSize: 14 }}>Carregando modelo PDF...</p>
            </div>
          ) : (
            <div
              style={{
                position: "relative",
                display: "inline-block",
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top center",
                transition: "transform 0.15s ease-out",
              }}
            >
              <PDFPageCanvas
                pdfDoc={pdfDoc}
                pageIndex={currentPage}
                onDimensionsReady={handleDimensionsReady}
              />
              {pageFields.map((field) => (
                <FieldBox
                  key={(field as any).id}
                  field={field}
                  canvasW={canvasSize.w}
                  canvasH={canvasSize.h}
                  isSelected={(field as any).id === selectedId}
                  showRealData={showRealData}
                  onSelect={() => setSelectedId((field as any).id)}
                  onChange={(patch) => updateField((field as any).id, patch)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar com Mapeamento e Propriedades */}
        <div
          style={{
            width: 320, borderLeft: "1px solid rgba(247,244,239,0.1)", background: "rgba(15,20,20,0.98)",
            display: "flex", flexDirection: "column",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(247,244,239,0.1)", background: "rgba(247,244,239,0.03)" }}>
            <h4 style={{ color: "#f7f4ef", fontSize: 13, fontWeight: 700, margin: 0 }}>
              {selectedField ? `Propriedades: ${selectedField.field_label}` : "Campos Mapeados na Página"}
            </h4>
          </div>

          {selectedField ? (
            <FieldPropertiesPanel
              field={selectedField}
              onUpdate={(patch) => updateField((selectedField as any).id, patch)}
              onDuplicate={() => duplicateField((selectedField as any).id)}
              onDelete={() => deleteField((selectedField as any).id)}
            />
          ) : (
            <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
              <p style={{ color: "#a0a0a0", fontSize: 11, marginBottom: 12 }}>
                Selecione um campo na folha ou abaixo para ajustar tipografia, posição e formatação:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pageFields.map((f) => (
                  <button
                    key={(f as any).id}
                    onClick={() => setSelectedId((f as any).id)}
                    style={{
                      padding: "8px 10px", borderRadius: 6, cursor: "pointer",
                      background: "rgba(247,244,239,0.06)", border: "1px solid rgba(247,244,239,0.12)",
                      color: "#f7f4ef", fontSize: 12, textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}
                  >
                    <span>{f.field_label}</span>
                    <span style={{ fontSize: 10, color: "#701117", fontWeight: 700 }}>{f.field_key}</span>
                  </button>
                ))}
                {pageFields.length === 0 && (
                  <div style={{ textAlign: "center", color: "#a0a0a0", padding: "20px 0", fontSize: 12 }}>
                    Nenhum campo mapeado nesta página.
                    <br />
                    Clique em <b>Adicionar Campo</b> para iniciar.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE DIAGNÓSTICO */}
      {showDiagnostics && (
        <div style={{ position: "absolute", top: 60, right: 340, zIndex: 250, width: 340, background: "#0f1414", border: "1px solid #701117", borderRadius: 12, padding: 16, color: "#f7f4ef", boxShadow: "0 10px 30px rgba(0,0,0,0.8)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#d4af37", display: "flex", alignItems: "center", gap: 6 }}>
              <Activity size={16} /> Painel de Diagnóstico do Match
            </h4>
            <button onClick={() => setShowDiagnostics(false)} style={{ background: "none", border: "none", color: "#f7f4ef", cursor: "pointer" }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ fontSize: 12, spaceY: 8 }} className="space-y-2">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#a0a0a0" }}>Total de Placeholders:</span>
              <b>{totalFields}</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#a0a0a0" }}>Páginas Mapeadas:</span>
              <b>{pagesWithFields.map((p) => p + 1).join(", ") || "Nenhuma"}</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#a0a0a0" }}>Duplicados Identificados:</span>
              <b style={{ color: duplicatedKeys.length > 0 ? "#f97b7b" : "#4ade80" }}>
                {duplicatedKeys.length > 0 ? duplicatedKeys.join(", ") : "Nenhum ✓"}
              </b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#a0a0a0" }}>Status do Documento:</span>
              <b style={{ color: totalFields > 0 ? "#4ade80" : "#d4af37" }}>
                {totalFields > 0 ? "Pronto para Emissão ✓" : "Aguardando Mapeamento"}
              </b>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ERRO ESTRUTURADO (Sem [object Object]) */}
      {errorModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 500, background: "#0f1414", border: "2px solid #701117", borderRadius: 16, padding: 24, color: "#f7f4ef", boxShadow: "0 20px 50px rgba(0,0,0,0.9)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#f97b7b", marginBottom: 12 }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Erro ao Salvar o Mapeamento</h3>
            </div>

            <div style={{ background: "rgba(247,244,239,0.05)", border: "1px solid rgba(247,244,239,0.1)", borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13, lineHeight: 1.5 }}>
              <p style={{ margin: "0 0 8px 0" }}><b>Motivo:</b> {errorModal.message}</p>
              <p style={{ margin: 0, color: "#d4af37", fontFamily: "monospace", fontSize: 11 }}><b>Código:</b> {errorModal.code}</p>
              {errorModal.details && (
                <pre style={{ marginTop: 8, fontSize: 10, color: "#a0a0a0", overflowX: "auto", whiteSpace: "pre-wrap" }}>
                  {errorModal.details}
                </pre>
              )}
            </div>

            <button
              onClick={() => setErrorModal(null)}
              style={{ width: "100%", padding: "10px 0", borderRadius: 8, background: "#701117", border: "none", color: "#f7f4ef", fontWeight: 700, cursor: "pointer" }}
            >
              Compreendido / Fechar
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE TESTE */}
      {showTestModal && (
        <TestFillModal
          fields={fields}
          templateUrl={template.file_url}
          onClose={() => setShowTestModal(false)}
        />
      )}
    </div>
  );
}
