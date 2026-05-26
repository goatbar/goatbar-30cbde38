import { useEffect, useMemo, useState } from "react";
import { proposalTemplatesService, type ProposalTemplate } from "@/services/proposal-service";
import { DEFAULT_TEMPLATE_FIELDS, TEMPLATE_FIELD_KEYS, type ProposalTemplateField, type TemplateFieldType } from "@/lib/proposal-template-mapper";
import { PrimaryButton, GhostButton } from "@/components/ui-bits";

const STAGE_WIDTH = 1600;
const STAGE_HEIGHT = 900;

const baseField = (templateId: string): ProposalTemplateField => ({
  template_id: templateId,
  page_number: 0,
  field_key: "data_orcamento",
  field_label: "Data orçamento",
  field_type: "texto_simples",
  x: 100,
  y: 100,
  width: 280,
  height: 40,
  font_family: "Helvetica",
  font_size: 24,
  font_color: "#FFFFFF",
  text_align: "left",
  font_weight: "normal",
  line_height: 1.2,
  letter_spacing: 0,
  z_index: 1,
  config: { format: "text", bullets: false, curved: false },
});

export function TemplateMapperEditor({ template, onClose }: { template: ProposalTemplate; onClose: () => void }) {
  const [fields, setFields] = useState<ProposalTemplateField[]>([]);
  const [selected, setSelected] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    proposalTemplatesService.listTemplateFields(template.id).then((list) => {
      if (list.length) setFields(list);
      else setFields(DEFAULT_TEMPLATE_FIELDS.map((f, i) => ({ ...baseField(template.id), ...f, y: 60 + i * 55 })));
    });
  }, [template.id]);

  const active = fields[selected];
  const pages = useMemo(() => [...new Set(fields.map((f) => f.page_number))].sort((a, b) => a - b), [fields]);
  const updateField = (patch: Partial<ProposalTemplateField>) => setFields((old) => old.map((f, i) => (i === selected ? { ...f, ...patch } : f)));

  const onDrag = (i: number, e: React.PointerEvent<HTMLButtonElement>) => {
    const rect = (e.currentTarget.parentElement as HTMLDivElement).getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * STAGE_WIDTH;
    const ny = ((e.clientY - rect.top) / rect.height) * STAGE_HEIGHT;
    setFields((old) => old.map((f, idx) => (idx === i ? { ...f, x: Math.max(0, nx), y: Math.max(0, ny) } : f)));
  };

  const save = async () => {
    setSaving(true);
    try {
      await proposalTemplatesService.replaceTemplateFields(template.id, fields);
      alert("Mapeamento salvo com sucesso.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-50 bg-black/80 p-6 overflow-auto"><div className="bg-surface rounded-xl p-4 space-y-4 max-w-[1450px] mx-auto">
    <div className="flex justify-between items-center"><h2 className="font-semibold">Editor visual de campos — {template.name}</h2>
      <div className="flex gap-2"><GhostButton onClick={onClose}>Fechar</GhostButton><PrimaryButton onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar mapeamento"}</PrimaryButton></div></div>
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-8"><div className="relative border rounded-lg bg-black/50 overflow-hidden" style={{ width: "100%", aspectRatio: `${STAGE_WIDTH}/${STAGE_HEIGHT}` }}>
        {template.file_url && <iframe src={template.file_url} className="absolute inset-0 w-full h-full opacity-50" title="PDF Preview" />}
        {fields.map((field, index) => <button key={index} onPointerMove={(e) => e.buttons === 1 && onDrag(index, e)} onClick={() => setSelected(index)} className={`absolute border text-[10px] px-1 py-0.5 ${index === selected ? "border-primary bg-primary/20" : "border-white/60 bg-black/60"}`} style={{ left: `${(field.x / STAGE_WIDTH) * 100}%`, top: `${(field.y / STAGE_HEIGHT) * 100}%`, width: `${(field.width / STAGE_WIDTH) * 100}%`, height: `${(field.height / STAGE_HEIGHT) * 100}%`, zIndex: field.z_index }}>{field.field_key}</button>)}
      </div></div>
      <div className="col-span-4 space-y-2">
        <div className="flex gap-2">
          <GhostButton onClick={() => setFields((old) => [...old, baseField(template.id)])}>Adicionar campo</GhostButton>
          <GhostButton onClick={() => setFields((old) => old.filter((_, i) => i !== selected))}>Excluir campo</GhostButton>
        </div>
        <div className="max-h-[40vh] overflow-auto space-y-1 border rounded p-2">{fields.map((f, i) => <button key={i} className={`w-full text-left text-xs p-2 rounded ${i===selected?"bg-primary/20":"bg-muted"}`} onClick={() => setSelected(i)}>{f.field_key} (p{f.page_number+1})</button>)}</div>
        {active && <div className="grid grid-cols-2 gap-2 text-xs">
          <select value={active.field_key} onChange={(e) => updateField({ field_key: e.target.value, field_label: e.target.value.replaceAll("_", " ") })} className="col-span-2 bg-background border rounded px-2 py-1">{TEMPLATE_FIELD_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}</select>
          <select value={active.field_type} onChange={(e) => updateField({ field_type: e.target.value as TemplateFieldType })} className="col-span-2 bg-background border rounded px-2 py-1"><option value="texto_simples">texto simples</option><option value="texto_multiline">texto multiline</option><option value="lista_dinamica">lista dinâmica</option><option value="moeda">moeda</option><option value="data">data</option><option value="numero">número</option><option value="texto_arco">texto em arco/circular</option></select>
          {(["page_number","x","y","width","height","font_size","line_height","letter_spacing","z_index"] as const).map((k) => <input key={k} type="number" value={(active as any)[k]} onChange={(e) => updateField({ [k]: Number(e.target.value) } as any)} className="bg-background border rounded px-2 py-1" placeholder={k} />)}
          <input value={active.font_family} onChange={(e) => updateField({ font_family: e.target.value })} className="bg-background border rounded px-2 py-1" placeholder="fonte" />
          <input type="color" value={active.font_color} onChange={(e) => updateField({ font_color: e.target.value })} className="bg-background border rounded px-2 py-1" />
          <select value={active.text_align} onChange={(e) => updateField({ text_align: e.target.value as any })} className="bg-background border rounded px-2 py-1"><option value="left">left</option><option value="center">center</option><option value="right">right</option></select>
          <select value={active.font_weight} onChange={(e) => updateField({ font_weight: e.target.value as any })} className="bg-background border rounded px-2 py-1"><option value="normal">normal</option><option value="bold">bold</option></select>
          <label className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={Boolean(active.config.bullets)} onChange={(e) => updateField({ config: { ...active.config, bullets: e.target.checked } })} /> lista com bullets</label>
          {active.field_type === "texto_arco" && <>
            <input type="number" value={Number(active.config.centerX ?? 300)} onChange={(e) => updateField({ config: { ...active.config, centerX: Number(e.target.value) } })} className="bg-background border rounded px-2 py-1" placeholder="centerX" />
            <input type="number" value={Number(active.config.centerY ?? 300)} onChange={(e) => updateField({ config: { ...active.config, centerY: Number(e.target.value) } })} className="bg-background border rounded px-2 py-1" placeholder="centerY" />
            <input type="number" value={Number(active.config.radius ?? 120)} onChange={(e) => updateField({ config: { ...active.config, radius: Number(e.target.value) } })} className="bg-background border rounded px-2 py-1" placeholder="radius" />
            <input type="number" value={Number(active.config.startAngle ?? 210)} onChange={(e) => updateField({ config: { ...active.config, startAngle: Number(e.target.value) } })} className="bg-background border rounded px-2 py-1" placeholder="startAngle" />
            <input type="number" value={Number(active.config.endAngle ?? 330)} onChange={(e) => updateField({ config: { ...active.config, endAngle: Number(e.target.value) } })} className="bg-background border rounded px-2 py-1" placeholder="endAngle" />
            <label className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={Boolean(active.config.uppercase)} onChange={(e) => updateField({ config: { ...active.config, uppercase: e.target.checked } })} /> transformar em maiúsculo</label>
          </>}
          <div className="col-span-2 grid grid-cols-2 gap-2"><GhostButton>Testar preenchimento</GhostButton><GhostButton>Gerar prévia</GhostButton><GhostButton>Baixar PDF</GhostButton><GhostButton>Editar campo</GhostButton></div>
        </div>}
        {pages.length > 0 && <div className="text-[11px] text-muted-foreground">Páginas mapeadas: {pages.map((p) => p + 1).join(", ")}</div>}
      </div>
    </div>
  </div></div>;
}
