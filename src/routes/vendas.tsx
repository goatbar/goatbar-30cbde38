import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatCard, SectionCard, PrimaryButton, GhostButton } from "@/components/ui-bits";
import { drinks, fmtBRL, fmtPct } from "@/lib/mock-data";
import { useAppStore } from "@/lib/app-store";
import { Plus, Filter, Download, DollarSign, TrendingUp, Wine, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/vendas")({
  component: () => (
    <AppShell>
      <VendasPage />
    </AppShell>
  ),
});

function VendasPage() {
  const { vendas, addVenda } = useAppStore();
  const receita = vendas.reduce((a, v) => a + v.precoUnitario * v.quantidade, 0);
  const custo = vendas.reduce((a, v) => a + v.custoUnitario * v.quantidade, 0);
  const lucro = receita - custo;
  const margem = receita ? (lucro / receita) * 100 : 0;
  const r = { receita, lucro, margem, ticketMedio: vendas.length ? receita / vendas.length : 0 };
  const recentes = [...vendas]
    .sort((a, b) => +new Date(b.data) - +new Date(a.data))
    .slice(0, 25);

  return (
    <>
      <PageHeader
        breadcrumb="Operação"
        title="Vendas"
        subtitle="Lançamentos de 7Steakhouse e Goat Botequim."
        action={
          <PrimaryButton onClick={() => {
            const d = drinks.find((x) => x.status === "ativo") ?? drinks[0];
            addVenda({
              data: new Date().toISOString(),
              unidade: "7Steakhouse",
              drinkId: d.id,
              drinkNome: d.nome,
              quantidade: 1,
              precoUnitario: d.precoVenda,
              custoUnitario: d.custoUnitario,
              observacoes: "Lançamento rápido via botão Nova venda",
            });
          }}>
            <Plus className="h-4 w-4" />
            Nova venda
          </PrimaryButton>
        }
      />

      <div className="px-8 py-7 space-y-7">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <StatCard label="Receita período" value={fmtBRL(r.receita)} delta={9.8} icon={<DollarSign className="h-4 w-4" />} />
          <StatCard label="Lucro" value={fmtBRL(r.lucro)} delta={11.2} hint={`Margem ${fmtPct(r.margem)}`} icon={<TrendingUp className="h-4 w-4" />} />
          <StatCard label="Drinks vendidos" value={vendas.reduce((a, v) => a + v.quantidade, 0).toLocaleString("pt-BR")} delta={6.5} icon={<Wine className="h-4 w-4" />} />
          <StatCard label="Ticket médio" value={fmtBRL(r.ticketMedio)} delta={2.1} icon={<BarChart3 className="h-4 w-4" />} />
        </div>

        <SectionCard
          title="Histórico de vendas"
          subtitle="Últimos lançamentos consolidados"
          action={
            <div className="flex items-center gap-2">
              <GhostButton><Filter className="h-3.5 w-3.5" /> Filtros</GhostButton>
              <GhostButton><Download className="h-3.5 w-3.5" /> Exportar</GhostButton>
            </div>
          }
        >
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  {["Data", "Unidade", "Drink", "Qtd", "Preço", "Receita", "Lucro", "Margem"].map((h) => (
                    <th key={h} className="label-eyebrow px-6 py-3 border-y border-border">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentes.map((v) => {
                  const receita = v.precoUnitario * v.quantidade;
                  const lucro = (v.precoUnitario - v.custoUnitario) * v.quantidade;
                  const margem = (lucro / receita) * 100;
                  return (
                    <tr key={v.id} className="border-b border-border/60 hover:bg-secondary/40 transition-colors">
                      <td className="px-6 py-3.5 text-muted-foreground">
                        {new Date(v.data).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="text-xs px-2 py-1 rounded-md bg-secondary">{v.unidade}</span>
                      </td>
                      <td className="px-6 py-3.5 font-medium">{v.drinkNome}</td>
                      <td className="px-6 py-3.5">{v.quantidade}</td>
                      <td className="px-6 py-3.5 text-muted-foreground">{fmtBRL(v.precoUnitario)}</td>
                      <td className="px-6 py-3.5 font-medium">{fmtBRL(receita)}</td>
                      <td className="px-6 py-3.5 text-success">{fmtBRL(lucro)}</td>
                      <td className="px-6 py-3.5 text-xs">{fmtPct(margem)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
