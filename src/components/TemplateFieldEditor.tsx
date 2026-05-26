/**
 * TemplateFieldEditor.tsx
 *
 * Editor visual drag-and-drop para mapeamento de campos dinâmicos
 * sobre as páginas PDF de um modelo de proposta comercial.
 *
 * Fluxo:
 *  1. Renderiza cada página do PDF em <canvas> via pdfjs-dist
 *  2. Sobrepõe divs arrastáveis/redimensionáveis para cada campo
 *  3. Painel lateral edita tipografia, cor, tipo e configs de arco
 *  4. Salva mapeamento no banco (proposal_template_fields)
 *  5. Modal "Testar Preenchimento" gera prévia com dados fictícios
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
} from "lucide-react";
import { proposalTemplatesService } from "@/services/proposal-service";
import { pdfGenerationService } from "@/services/proposal-service";
import type {
  ProposalTemplate,
} from "@/services/proposal-service";
import type {
  ProposalTemplateField,
  TemplateFieldType,
  FieldAlign,
  FieldWeight,
} from "@/lib/proposal-template-mapper";
import { TEMPLATE_FIELD_KEYS } from "@/lib/proposal-template-mapper";

// ─── PDF.js worker ──────────────────────────────────────────────
pdfjs.GlobalWorkerOptions.workerSrc =
  "https://unpkg.com/pdfjs-dist@5.3.31/build/pdf.worker.min.mjs";

// ─── Constants ──────────────────────────────────────────────────
const BRAND_COLORS = [
  { label: "Vermelho", value: "#701117" },
  { label: "Creme", value: "#f7f4ef" },
  { label: "Escuro", value: "#0f1414" },
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
};

// Mock data for "Testar Preenchimento"
const MOCK_DATA: Record<string, string> = {
  data_orcamento: "26/05/2026",
  tipo_evento: "CASAMENTO",
  nome_evento: "Casamento dos Sonhos",
  nome_cliente: "Ana & Pedro",
  nome_casal: "Ana & Pedro",
  data_evento: "14/12/2026",
  lista_drinks: "Gin Tônica\nAperol Spritz\nMojito\nNegroni",
  lista_bebidas: "Vinho Branco\nCerveja Artesanal\nSucos Naturais",
  numero_convidados: "180",
  quantidade_bartenders: "3",
  quantidade_bar_keeper: "2",
  quantidade_copeira: "2",
  quantidade_drinks: "12",
  investimento_total: "R$ 18.500,00",
  forma_pagamento: "50% na assinatura\n50% no evento",
};

function makeDefaultField(
  templateId: string,
  pageNumber: number
): ProposalTemplateField {
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
    config: {},
  };
}

// ─── ArcPreviewSVG ───────────────────────────────────────────────
function ArcPreviewSVG({
  field,
  canvasW,
  canvasH,
}: {
  field: ProposalTemplateField;
  canvasW: number;
  canvasH: number;
}) {
  const cfg = field.config as {
    radius?: number;
    centerX?: number;
    centerY?: number;
    startAngle?: number;
    endAngle?: number;
    direction?: string;
    uppercase?: boolean;
    arcPosition?: string;
  };

  const radius = (cfg.radius ?? 120) * Math.min(canvasW, canvasH);
  const cx = (cfg.centerX ?? 0.5) * canvasW;
  const cy = (cfg.centerY ?? 0.5) * canvasH;
  const startDeg = cfg.startAngle ?? 200;
  const endDeg = cfg.endAngle ?? 340;
  const isBottom = cfg.arcPosition === "bottom";
  const sampleText = (
    cfg.uppercase
      ? (MOCK_DATA[field.field_key] ?? field.field_label).toUpperCase()
      : (MOCK_DATA[field.field_key] ?? field.field_label)
  ).slice(0, 30);

  const startRad = (startDeg * Math.PI) / 180;
  const endRad = (endDeg * Math.PI) / 180;
  const arcId = `arc-${field.id ?? Math.random().toString(36).slice(2)}`;

  // Build arc path
  const x1 = cx + radius * Math.cos(startRad);
  const y1 = cy + radius * Math.sin(startRad);
  const x2 = cx + radius * Math.cos(endRad);
  const y2 = cy + radius * Math.sin(endRad);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = isBottom ? 0 : 1;

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: canvasW,
        height: canvasH,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      <defs>
        <path
          id={arcId}
          d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${x2} ${y2}`}
        />
      </defs>
      {/* Guide circle */}
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
          <Loader2
            className="animate-spin"
            style={{ color: "#f7f4ef", width: 32, height: 32 }}
          />
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{ display: "block", borderRadius: 4 }}
      />
    </div>
  );
}

// ─── FieldBox ─────────────────────────────────────────────────────
function FieldBox({
  field,
  canvasW,
  canvasH,
  isSelected,
  onSelect,
  onChange,
}: {
  field: ProposalTemplateField;
  canvasW: number;
  canvasH: number;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<ProposalTemplateField>) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ mx: number; my: number; x: number; y: number } | null>(null);
  const resizeStartRef = useRef<{ mx: number; my: number; w: number; h: number } | null>(null);

  const px = field.x * canvasW;
  const py = field.y * canvasH;
  const pw = field.width * canvasW;
  const ph = field.height * canvasH;

  // Drag handlers
  const onDragMouseDown = (e: RMouseEvent) => {
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

  const previewText =
    field.field_type === "texto_arco"
      ? null
      : field.config?.uppercase
        ? (MOCK_DATA[field.field_key] ?? field.field_label).toUpperCase()
        : MOCK_DATA[field.field_key] ?? field.field_label;

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
        border: isSelected ? "2px solid #701117" : "1.5px dashed rgba(247,244,239,0.5)",
        background: isSelected ? "rgba(112,17,23,0.12)" : "rgba(247,244,239,0.06)",
        cursor: "move",
        borderRadius: 3,
        zIndex: field.z_index,
        userSelect: "none",
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        alignItems: "flex-start",
        padding: "2px 4px",
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
            whiteSpace: "pre-wrap",
            overflow: "hidden",
            width: "100%",
          }}
        >
          {previewText}
        </span>
      )}

      {/* Field type badge */}
      <span
        style={{
          position: "absolute",
          bottom: 2,
          right: 20,
          fontSize: 9,
          background: "#701117",
          color: "#f7f4ef",
          padding: "1px 4px",
          borderRadius: 3,
          fontFamily: "sans-serif",
          pointerEvents: "none",
        }}
      >
        {field.field_key}
      </span>

      {/* Resize handle */}
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
    </div>
  );
}

// ─── ColorPicker ────────────────────────────────────────────────
function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
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
    centerX?: number;
    centerY?: number;
    startAngle?: number;
    endAngle?: number;
    direction?: string;
    uppercase?: boolean;
    arcPosition?: string;
  };

  const set = (key: string, val: unknown) => onChange({ ...config, [key]: val });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={() => { set("arcPosition", "top"); set("startAngle", 200); set("endAngle", 340); set("direction", "clockwise"); }}
          style={{
            flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600,
            background: cfg.arcPosition !== "bottom" ? "#701117" : "rgba(247,244,239,0.08)",
            color: "#f7f4ef", border: "1px solid rgba(112,17,23,0.4)",
          }}
        >
          ⌢ Arco Superior
        </button>
        <button
          onClick={() => { set("arcPosition", "bottom"); set("startAngle", 20); set("endAngle", 160); set("direction", "counterclockwise"); }}
          style={{
            flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600,
            background: cfg.arcPosition === "bottom" ? "#701117" : "rgba(247,244,239,0.08)",
            color: "#f7f4ef", border: "1px solid rgba(112,17,23,0.4)",
          }}
        >
          ⌣ Arco Inferior
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {([
          ["Raio (relativo)", "radius", 0.01, 0.5, 0.001],
          ["Centro X (0–1)", "centerX", 0, 1, 0.01],
          ["Centro Y (0–1)", "centerY", 0, 1, 0.01],
          ["Âng. Início (°)", "startAngle", 0, 360, 1],
          ["Âng. Fim (°)", "endAngle", 0, 360, 1],
          ["Espaç. letras", "letterSpacing", -10, 50, 0.5],
        ] as [string, string, number, number, number][]).map(([label, key, min, max, step]) => (
          <label key={key} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 10, color: "#a0a0a0" }}>{label}</span>
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={(cfg as any)[key] ?? ""}
              onChange={(e) => set(key, parseFloat(e.target.value))}
              style={{
                background: "rgba(247,244,239,0.08)", border: "1px solid rgba(247,244,239,0.15)",
                borderRadius: 4, padding: "3px 6px", color: "#f7f4ef", fontSize: 12,
              }}
            />
          </label>
        ))}
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={!!cfg.uppercase}
          onChange={(e) => set("uppercase", e.target.checked)}
          style={{ accentColor: "#701117" }}
        />
        <span style={{ fontSize: 12, color: "#f7f4ef" }}>Transformar em MAIÚSCULO</span>
      </label>
    </div>
  );
}

// ─── FieldPropertiesPanel ────────────────────────────────────────
function FieldPropertiesPanel({
  field,
  onUpdate,
  onDelete,
}: {
  field: ProposalTemplateField;
  onUpdate: (patch: Partial<ProposalTemplateField>) => void;
  onDelete: () => void;
}) {
  const panelBg = "rgba(15,20,20,0.95)";
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
    <div
      style={{
        background: panelBg, width: 280, flexShrink: 0, overflowY: "auto",
        borderLeft: "1px solid rgba(247,244,239,0.1)", padding: "14px 14px 24px",
        display: "flex", flexDirection: "column", gap: 6,
      }}
    >
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
        <label>
          <span style={labelStyle}>Z-Index</span>
          <input
            type="number" min={1} value={field.z_index}
            onChange={(e) => onUpdate({ z_index: parseInt(e.target.value) })}
            style={inputStyle}
          />
        </label>
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 4 }}>
        <label>
          <span style={labelStyle}>Line-height</span>
          <input type="number" min={0.8} max={4} step={0.1} value={field.line_height}
            onChange={(e) => onUpdate({ line_height: parseFloat(e.target.value) })} style={inputStyle} />
        </label>
        <label>
          <span style={labelStyle}>Espaç. letras</span>
          <input type="number" min={-5} max={30} step={0.5} value={field.letter_spacing}
            onChange={(e) => onUpdate({ letter_spacing: parseFloat(e.target.value) })} style={inputStyle} />
        </label>
      </div>

      {/* Arc-specific config */}
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
        "comemoracao"
      );
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
    } catch (e) {
      console.error(e);
      alert("Erro ao gerar prévia: " + String(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 300, background: "rgba(15,20,20,0.92)",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid rgba(247,244,239,0.1)" }}>
        <h3 style={{ color: "#f7f4ef", fontFamily: "'Neue Montreal', sans-serif", fontSize: 16, fontWeight: 700, margin: 0 }}>
          🧪 Testar Preenchimento
        </h3>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#f7f4ef", cursor: "pointer" }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Data inputs */}
        <div style={{ width: 300, padding: 16, overflowY: "auto", borderRight: "1px solid rgba(247,244,239,0.1)", display: "flex", flexDirection: "column", gap: 10 }}>
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
                  placeholder="Um item por linha"
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

        {/* PDF Preview */}
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
  const [savedCount, setSavedCount] = useState<null | number>(null);

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

  const deleteField = (id: string) => {
    setFields((prev) => prev.filter((f) => (f as any).id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const saveMapping = async () => {
    setSaving(true);
    try {
      const saved = await proposalTemplatesService.replaceTemplateFields(template.id, fields);
      setFields(saved.map((f) => ({ ...f, id: f.id ?? Math.random().toString(36) })));
      setSavedCount(saved.length);
      setTimeout(() => setSavedCount(null), 3000);
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar mapeamento: " + String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!template.file_url) return alert("Modelo sem PDF base.");
    try {
      const bytes = await pdfGenerationService.generateProposalPDF(
        template.file_url,
        {
          proposalDate: "26/05/2026",
          eventDate: "14/12/2026",
          clientName: "Prévia do Modelo",
          eventTypeLabel: "EVENTO",
          selectedDrinks: ["Gin Tônica", "Mojito"],
          includedBeverages: ["Vinho", "Cerveja"],
          guests: 100,
          bartenders: 2,
          keepers: 1,
          copeiras: 1,
          totalDrinkVarieties: 8,
          finalInvestment: 15000,
          paymentTerms: "50% na assinatura\n50% no evento",
          includedServices: [],
        },
        template.event_type
      );
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${template.name}-preview.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      alert("Erro ao gerar PDF: " + String(e));
    }
  };

  const selectedField = fields.find((f) => (f as any).id === selectedId) ?? null;
  const pageFields = fields.filter((f) => f.page_number === currentPage);

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

        {/* Page nav */}
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

        <button onClick={(e) => { e.stopPropagation(); addField(); }} style={{ ...btnBase, background: "#701117" }}>
          <Plus size={14} /> Adicionar Campo
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); saveMapping(); }}
          disabled={saving}
          style={{ ...btnBase, background: saving ? "rgba(112,17,23,0.4)" : "#701117", border: "2px solid #701117" }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? "Salvando..." : savedCount !== null ? `✓ ${savedCount} campos salvos!` : "Salvar Mapeamento"}
        </button>

        <div style={{ height: 28, width: 1, background: "rgba(247,244,239,0.12)" }} />

        <button onClick={(e) => { e.stopPropagation(); setShowTestModal(true); }} style={{ ...btnBase, background: "rgba(247,244,239,0.06)", border: "1px solid rgba(247,244,239,0.12)" }}>
          <FlaskConical size={14} /> Testar Preenchimento
        </button>

        <button onClick={(e) => { e.stopPropagation(); handleDownloadPDF(); }} style={{ ...btnBase, background: "rgba(247,244,239,0.06)", border: "1px solid rgba(247,244,239,0.12)" }}>
          <Download size={14} /> Baixar PDF Prévia
        </button>

        <div style={{ marginLeft: "auto", color: "#a0a0a0", fontSize: 11 }}>
          {fields.length} campo(s) mapeado(s) · {template.name}
        </div>
      </div>

      {/* ─── MAIN CONTENT ────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Canvas area */}
        <div
          style={{ flex: 1, overflow: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 24, background: "#1a1e1e" }}
          onClick={(e) => e.stopPropagation()}
        >
          {loadingPdf ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: 80, color: "#f7f4ef" }}>
              <Loader2 size={40} className="animate-spin" style={{ color: "#701117" }} />
              <p style={{ fontSize: 13, color: "#a0a0a0" }}>Carregando PDF...</p>
            </div>
          ) : !template.file_url ? (
            <div style={{ textAlign: "center", marginTop: 80, color: "#a0a0a0" }}>
              <p>Este modelo não tem PDF base. Faça upload primeiro.</p>
            </div>
          ) : (
            <div style={{ position: "relative", boxShadow: "0 8px 40px rgba(0,0,0,0.6)", borderRadius: 4 }}>
              <PDFPageCanvas
                pdfDoc={pdfDoc}
                pageIndex={currentPage}
                onDimensionsReady={handleDimensionsReady}
                scale={1.2}
              />

              {/* Field overlays */}
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                {pageFields.map((f) => {
                  const fid = (f as any).id as string;
                  return (
                    <div key={fid} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                      {/* Arc SVG preview */}
                      {f.field_type === "texto_arco" && (
                        <ArcPreviewSVG field={f} canvasW={canvasSize.w * 1.2} canvasH={canvasSize.h * 1.2} />
                      )}
                      {/* Regular field box */}
                      {f.field_type !== "texto_arco" && (
                        <div style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}>
                          <FieldBox
                            field={f}
                            canvasW={canvasSize.w * 1.2}
                            canvasH={canvasSize.h * 1.2}
                            isSelected={selectedId === fid}
                            onSelect={() => setSelectedId(fid)}
                            onChange={(patch) => updateField(fid, patch)}
                          />
                        </div>
                      )}
                      {/* Arc click target */}
                      {f.field_type === "texto_arco" && (
                        <div
                          style={{
                            position: "absolute",
                            left: f.x * canvasSize.w * 1.2,
                            top: f.y * canvasSize.h * 1.2,
                            width: f.width * canvasSize.w * 1.2,
                            height: f.height * canvasSize.h * 1.2,
                            cursor: "pointer",
                            pointerEvents: "auto",
                            border: selectedId === fid ? "1.5px dashed #701117" : "1px dashed rgba(247,244,239,0.3)",
                            borderRadius: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          onClick={(e) => { e.stopPropagation(); setSelectedId(fid); }}
                        >
                          <span style={{ fontSize: 9, color: "rgba(247,244,239,0.6)", fontFamily: "sans-serif", background: "rgba(15,20,20,0.7)", padding: "1px 4px", borderRadius: 3 }}>
                            arco · {f.field_key}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Empty state */}
              {pageFields.length === 0 && (
                <div style={{
                  position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  pointerEvents: "none",
                }}>
                  <div style={{
                    background: "rgba(15,20,20,0.75)", borderRadius: 10, padding: "16px 24px",
                    textAlign: "center", border: "1px dashed rgba(247,244,239,0.2)",
                  }}>
                    <Move size={28} style={{ color: "#701117", marginBottom: 6 }} />
                    <p style={{ color: "#f7f4ef", fontSize: 13, fontWeight: 600, margin: "0 0 2px" }}>
                      Nenhum campo nesta página
                    </p>
                    <p style={{ color: "#a0a0a0", fontSize: 11, margin: 0 }}>
                      Clique em "+ Adicionar Campo" na toolbar
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Properties panel */}
        <div onClick={(e) => e.stopPropagation()}>
          {selectedField ? (
            <FieldPropertiesPanel
              field={selectedField}
              onUpdate={(patch) => updateField((selectedField as any).id, patch)}
              onDelete={() => deleteField((selectedField as any).id)}
            />
          ) : (
            <div style={{
              width: 280, borderLeft: "1px solid rgba(247,244,239,0.1)", background: "rgba(15,20,20,0.95)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              color: "#a0a0a0", padding: 24, textAlign: "center", gap: 8,
            }}>
              <RotateCcw size={32} style={{ opacity: 0.25 }} />
              <p style={{ fontSize: 13, margin: 0 }}>Selecione um campo no canvas para editar</p>
              <p style={{ fontSize: 11, margin: 0 }}>ou clique em "+ Adicionar Campo"</p>
            </div>
          )}
        </div>
      </div>

      {/* Test modal */}
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
