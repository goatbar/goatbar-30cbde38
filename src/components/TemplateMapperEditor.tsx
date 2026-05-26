import { useEffect, useMemo, useState } from "react";
import { proposalTemplatesService, type ProposalTemplate } from "@/services/proposal-service";
import { DEFAULT_TEMPLATE_FIELDS, type ProposalTemplateField, type TemplateFieldType } from "@/lib/proposal-template-mapper";
import { PrimaryButton, GhostButton } from "@/components/ui-bits";

const STAGE_WIDTH = 1600;
const STAGE_HEIGHT = 900;

const baseField = (templateId: string): ProposalTemplateField => ({
  template_id: templateId,
  technical_name: "novo_campo",
  label: "Novo campo",
  field_type: "texto_simples",
  page: 0,
  position_x: 100,
  position_y: 100,
  width: 280,
  height: 40,
  font_family: "Helvetica",
  font_size: 24,
  color_hex: "#FFFFFF",
  alignment: "left",
  font_weight: "normal",
  line_height: 1.2,
  auto_resize: true,
  overflow_control: "wrap",
  arc_angle: 160,
  arc_radius: 180,
  image_fit: "contain",
});

export function TemplateMapperEditor({ template, onClose }: { template: ProposalTemplate; onClose: () => void }) {
  const [fields, setFields] = useState<ProposalTemplateField[]>([]);
  const [selected, setSelected] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    proposalTemplatesService.listTemplateFields(template.id).then((list) => {
      if (list.length) setFields(list);
      else {
        setFields(DEFAULT_TEMPLATE_FIELDS.map((f, i) => ({ ...baseField(template.id), ...f, position_y: 60 + i * 55 })));
      }
    });
  }, [template.id]);

  const active = fields[selected];
  const pages = useMemo(() => [...new Set(fields.map((f) => f.page))].sort((a, b) => a - b), [fields]);

  const updateField = (patch: Partial<ProposalTemplateField>) => {
    setFields((old) => old.map((f, i) => (i === selected ? { ...f, ...patch } : f)));
  };

  const save = async () => {
    setSaving(true);
    try {
      await proposalTemplatesService.replaceTemplateFields(template.id, fields);
      alert("Mapeamento salvo com sucesso.");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-50 bg-black/80 p-6 overflow-auto">
    <div className="bg-surface rounded-xl p-4 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">Template Mapper Visual — {template.name}</h2>
        <div className="flex gap-2"><GhostButton onClick={onClose}>Fechar</GhostButton><PrimaryButton onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar mapeamento"}</PrimaryButton></div>
      </div>
      <div className="text-xs text-muted-foreground">Upload do PDF já realizado. Use o preview abaixo para mapear campos dinamicamente (texto, lista, moeda, data, número, arco e imagem).</div>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8">
          <div className="relative border rounded-lg bg-black/50 overflow-hidden" style={{ width: "100%", aspectRatio: `${STAGE_WIDTH}/${STAGE_HEIGHT}` }}>
            {template.file_url && <iframe src={template.file_url} className="absolute inset-0 w-full h-full opacity-50" title="PDF Preview" />}
            {fields.map((field, index) => (
              <button key={index} onClick={() => setSelected(index)} className={`absolute border text-[10px] px-1 py-0.5 ${index === selected ? "border-primary bg-primary/20" : "border-white/60 bg-black/60"}`} style={{ left: `${(field.position_x / STAGE_WIDTH) * 100}%`, top: `${(field.position_y / STAGE_HEIGHT) * 100}%`, width: `${(field.width / STAGE_WIDTH) * 100}%`, height: `${(field.height / STAGE_HEIGHT) * 100}%` }}>
                {field.technical_name}
              </button>
            ))}
          </div>
        </div>
        <div className="col-span-4 space-y-2">
          <GhostButton onClick={() => setFields((old) => [...old, baseField(template.id)])}>+ Novo campo</GhostButton>
          <div className="max-h-[50vh] overflow-auto space-y-1 border rounded p-2">
            {fields.map((f, i) => <button key={i} className={`w-full text-left text-xs p-2 rounded ${i===selected?"bg-primary/20":"bg-muted"}`} onClick={() => setSelected(i)}>{f.technical_name} (p{f.page+1})</button>)}
          </div>
          {active && <div className="grid grid-cols-2 gap-2 text-xs">
            <input value={active.technical_name} onChange={(e) => updateField({ technical_name: e.target.value })} className="col-span-2 bg-background border rounded px-2 py-1" placeholder="nome técnico" />
            <input value={active.label} onChange={(e) => updateField({ label: e.target.value })} className="col-span-2 bg-background border rounded px-2 py-1" placeholder="label" />
            <select value={active.field_type} onChange={(e) => updateField({ field_type: e.target.value as TemplateFieldType })} className="col-span-2 bg-background border rounded px-2 py-1">
              <option value="texto_simples">texto simples</option><option value="texto_multiline">texto multiline</option><option value="lista_dinamica">lista dinâmica</option><option value="moeda">moeda</option><option value="data">data</option><option value="numero">número</option><option value="texto_arco">texto arco</option><option value="imagem_dinamica">imagem dinâmica</option>
            </select>
            {(["page","position_x","position_y","width","height","font_size"] as const).map((k) => <input key={k} type="number" value={(active as any)[k]} onChange={(e) => updateField({ [k]: Number(e.target.value) } as any)} className="bg-background border rounded px-2 py-1" placeholder={k} />)}
            <input value={active.font_family} onChange={(e) => updateField({ font_family: e.target.value })} className="bg-background border rounded px-2 py-1" placeholder="fonte" />
            <input type="color" value={active.color_hex} onChange={(e) => updateField({ color_hex: e.target.value })} className="bg-background border rounded px-2 py-1" />
          </div>}
          {pages.length > 0 && <div className="text-[11px] text-muted-foreground">Páginas mapeadas: {pages.map((p) => p + 1).join(", ")}</div>}
        </div>
      </div>
    </div>
  </div>;
}
