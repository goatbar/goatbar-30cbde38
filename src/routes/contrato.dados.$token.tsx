import { createFileRoute } from "@tanstack/react-router";
import { PrimaryButton, SectionCard } from "@/components/ui-bits";
import { useState, useEffect } from "react";
import logo from "@/assets/goatbar-logo.png";
import { CheckCircle2, Lock, Loader2, AlertTriangle } from "lucide-react";
import { clientContractFormService } from "@/services/contract-service";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/contrato/dados/$token")({
  component: ContratoDadosPublicPage,
});

function ContratoDadosPublicPage() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [eventoInfo, setEventoInfo] = useState<{ nome: string; data: string } | null>(null);
  
  const [formData, setFormData] = useState({
    client_name: "",
    cpf_cnpj: "",
    phone: "",
    email: "",
    address: "",
    legal_representative_name: "",
    legal_representative_cpf: "",
    notes: "",
  });

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    setLoading(true);
    try {
      const data = await clientContractFormService.getFormByToken(token);
      
      // Busca info básica do evento para o cliente ver
      // Nota: Como é público, acessamos apenas o necessário
      const { data: ev } = await supabase
        .from("event_contract_client_data") // Aqui poderíamos fazer um join se a política permitisse
        .select("event_id")
        .eq("public_token", token)
        .single();

      // Para este MVP, vamos assumir que o sistema interno já populou o nome do cliente ou evento se necessário
      // Ou podemos fazer uma query simples se a RLS permitir
      setEventoInfo({ nome: "Seu Evento", data: "" }); 
      
      if (data.submitted_at) {
        setSubmitted(true);
      }
    } catch (e) {
      setError("O link acessado é inválido ou já expirou.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await clientContractFormService.submitClientData(token, formData);
      setSubmitted(true);
    } catch (e) {
      alert("Erro ao enviar dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="font-display text-2xl mb-2">Link Inválido</h2>
        <p className="text-muted-foreground max-w-sm">{error}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md p-8 bg-surface border border-border rounded-2xl text-center space-y-4 shadow-xl">
          <div className="h-16 w-16 mx-auto bg-success/10 rounded-full flex items-center justify-center text-success">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="font-display text-2xl">Dados Recebidos!</h2>
          <p className="text-muted-foreground">Suas informações foram enviadas com segurança. Em breve você receberá o contrato para assinatura digital.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4 flex flex-col items-center">
      <div className="w-full max-w-2xl mb-8 flex flex-col items-center">
        <img src={logo} alt="GOAT BAR" className="h-16 w-auto mb-6" />
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-center leading-tight">Coleta de Dados <br/>para Contrato</h1>
        <p className="text-muted-foreground text-center mt-3 max-w-lg">
          Para a formalização do seu contrato com a <strong>Goat Bar</strong>, por favor preencha os dados legais abaixo.
        </p>
      </div>

      <div className="w-full max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <SectionCard title="Dados do Contratante" subtitle="Informações que constarão no contrato">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="label-eyebrow block mb-2">Nome Completo ou Razão Social *</label>
                <input required type="text" value={formData.client_name} onChange={e => setFormData(p => ({...p, client_name: e.target.value}))} className="w-full h-11 px-4 rounded-lg bg-input border border-border text-sm" />
              </div>
              <div>
                <label className="label-eyebrow block mb-2">CPF ou CNPJ *</label>
                <input required type="text" value={formData.cpf_cnpj} onChange={e => setFormData(p => ({...p, cpf_cnpj: e.target.value}))} className="w-full h-11 px-4 rounded-lg bg-input border border-border text-sm" />
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
                <label className="label-eyebrow block mb-2">Endereço Completo *</label>
                <input required type="text" value={formData.address} onChange={e => setFormData(p => ({...p, address: e.target.value}))} className="w-full h-11 px-4 rounded-lg bg-input border border-border text-sm" />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Representante Legal" subtitle="Preencha apenas se for Pessoa Jurídica">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="label-eyebrow block mb-2">Nome do Representante</label>
                <input type="text" value={formData.legal_representative_name} onChange={e => setFormData(p => ({...p, legal_representative_name: e.target.value}))} className="w-full h-11 px-4 rounded-lg bg-input border border-border text-sm" />
              </div>
              <div>
                <label className="label-eyebrow block mb-2">CPF do Representante</label>
                <input type="text" value={formData.legal_representative_cpf} onChange={e => setFormData(p => ({...p, legal_representative_cpf: e.target.value}))} className="w-full h-11 px-4 rounded-lg bg-input border border-border text-sm" />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Observações Finais" subtitle="Detalhes adicionais para o contrato">
            <textarea value={formData.notes} onChange={e => setFormData(p => ({...p, notes: e.target.value}))} className="w-full resize-y min-h-[100px] rounded-lg border border-border bg-input px-3 py-2.5 text-sm" placeholder="Ex: Informações de faturamento..."></textarea>
          </SectionCard>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background px-3 py-1.5 rounded-full border border-border">
              <Lock className="h-3 w-3" /> Ambiente Seguro (Goat Bar System)
            </div>
            <PrimaryButton type="submit" disabled={loading} className="w-full sm:w-auto h-12 px-8 text-base shadow-lg shadow-primary/20">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enviar Dados
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
