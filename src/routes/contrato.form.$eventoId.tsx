import { createFileRoute } from "@tanstack/react-router";
import { PrimaryButton, SectionCard } from "@/components/ui-bits";
import { useAppStore } from "@/lib/app-store";
import { useState } from "react";
import logo from "@/assets/goatbar-logo.png";
import { CheckCircle2, Lock } from "lucide-react";

export const Route = createFileRoute("/contrato/form/$eventoId")({
  component: ContratoFormPage,
});

function ContratoFormPage() {
  const { eventoId } = Route.useParams();
  const { eventos, addEventContractClientData, updateEvento } = useAppStore();
  const evento = eventos.find((e) => e.id === eventoId);

  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    clientName: "",
    cpfCnpj: "",
    phone: "",
    email: "",
    address: "",
    legalRepresentativeName: "",
    legalRepresentativeCpf: "",
    notes: "",
  });

  if (!evento) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <img src={logo} alt="GOAT BAR" className="h-16 w-auto mb-6" />
        <h2 className="font-display text-2xl mb-2">Evento não encontrado</h2>
        <p className="text-muted-foreground text-center">O link que você tentou acessar é inválido ou expirou.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md p-8 bg-surface border border-border rounded-2xl text-center space-y-4">
          <div className="h-16 w-16 mx-auto bg-success/10 rounded-full flex items-center justify-center text-success">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="font-display text-2xl">Dados Recebidos!</h2>
          <p className="text-muted-foreground">Suas informações foram enviadas com segurança para a Goat Bar. Em breve você receberá o contrato para assinatura digital.</p>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName || !formData.cpfCnpj || !formData.email || !formData.address) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }
    
    addEventContractClientData({
      eventId: evento.id,
      ...formData,
      submittedAt: new Date().toISOString(),
    });

    const newHist = [
      { data: new Date().toISOString(), status: "dados_recebidos" as any, observacao: "Cliente preencheu o formulário de contrato." },
      ...evento.historicoNegociacao
    ];
    updateEvento(evento.id, { status: "dados_recebidos" as any, historicoNegociacao: newHist });
    
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background py-10 px-4 flex flex-col items-center">
      <div className="w-full max-w-2xl mb-8 flex flex-col items-center">
        <img src={logo} alt="GOAT BAR" className="h-16 w-auto mb-6" />
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-center leading-tight">Coleta de Dados <br/>para Contrato</h1>
        <p className="text-muted-foreground text-center mt-3 max-w-lg">
          Para a formalização do evento <strong>{evento.nome}</strong> (Data: {new Date(evento.data).toLocaleDateString("pt-BR")}), por favor preencha os dados abaixo.
        </p>
      </div>

      <div className="w-full max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <SectionCard title="Dados do Contratante" subtitle="Informações legais que constarão no contrato">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="label-eyebrow block mb-2">Nome Completo ou Razão Social *</label>
                <input required type="text" value={formData.clientName} onChange={e => setFormData(p => ({...p, clientName: e.target.value}))} className="w-full h-11 px-4 rounded-lg bg-input border border-border text-sm" />
              </div>
              <div>
                <label className="label-eyebrow block mb-2">CPF ou CNPJ *</label>
                <input required type="text" value={formData.cpfCnpj} onChange={e => setFormData(p => ({...p, cpfCnpj: e.target.value}))} className="w-full h-11 px-4 rounded-lg bg-input border border-border text-sm" />
              </div>
              <div>
                <label className="label-eyebrow block mb-2">Telefone com DDD *</label>
                <input required type="text" value={formData.phone} onChange={e => setFormData(p => ({...p, phone: e.target.value}))} className="w-full h-11 px-4 rounded-lg bg-input border border-border text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="label-eyebrow block mb-2">E-mail *</label>
                <input required type="email" value={formData.email} onChange={e => setFormData(p => ({...p, email: e.target.value}))} className="w-full h-11 px-4 rounded-lg bg-input border border-border text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="label-eyebrow block mb-2">Endereço Completo (Rua, Nº, Bairro, Cidade, CEP) *</label>
                <input required type="text" value={formData.address} onChange={e => setFormData(p => ({...p, address: e.target.value}))} className="w-full h-11 px-4 rounded-lg bg-input border border-border text-sm" />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Representante Legal" subtitle="Preencha apenas se o contratante for Pessoa Jurídica">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="label-eyebrow block mb-2">Nome do Representante</label>
                <input type="text" value={formData.legalRepresentativeName} onChange={e => setFormData(p => ({...p, legalRepresentativeName: e.target.value}))} className="w-full h-11 px-4 rounded-lg bg-input border border-border text-sm" />
              </div>
              <div>
                <label className="label-eyebrow block mb-2">CPF do Representante</label>
                <input type="text" value={formData.legalRepresentativeCpf} onChange={e => setFormData(p => ({...p, legalRepresentativeCpf: e.target.value}))} className="w-full h-11 px-4 rounded-lg bg-input border border-border text-sm" />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Observações Finais" subtitle="Algum detalhe adicional para o seu contrato?">
            <textarea value={formData.notes} onChange={e => setFormData(p => ({...p, notes: e.target.value}))} className="w-full resize-y min-h-[100px] rounded-lg border border-border bg-input px-3 py-2.5 text-sm" placeholder="Ex: A NF deve ser emitida para a filial..."></textarea>
          </SectionCard>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background px-3 py-1.5 rounded-full border border-border">
              <Lock className="h-3 w-3" /> Ambiente Seguro (LGPD)
            </div>
            <PrimaryButton type="submit" className="w-full sm:w-auto h-12 px-8 text-base shadow-lg shadow-primary/20">Enviar Dados</PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
