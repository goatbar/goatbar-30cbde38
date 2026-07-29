import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { uploadDocument, createSigner, createAssignment } from "../_shared/assinafy-client.ts";

serve(async (req) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Create a mock event and contract for testing
    const { data: mockEvent, error: evErr } = await supabaseAdmin.from("events").insert({
        client_name: "Teste E2E Goat Bar",
        event_type: "Casamento",
        date: "2026-12-31",
        guests: 150,
        email: "teste@goatbar.com.br",
        phone: "11999999999",
        duration_hours: 4
    }).select("id").single();
    if (evErr) throw new Error("Event err: " + evErr.message);

    const { data: mockContract, error: ctrErr } = await supabaseAdmin.from("event_contracts").insert({
        event_id: mockEvent.id
    }).select("id").single();
    if (ctrErr) throw new Error("Contract err: " + ctrErr.message);

    const { data: contract, error: cErr } = await supabaseAdmin
      .from("event_contracts")
      .select("*")
      .eq("id", mockContract.id)
      .single();

    if (cErr || !contract) throw new Error("No contracts found. cErr: " + cErr?.message);

    const contractId = contract.id;
    const dummyPdf = "JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nDPQM1Qo5ypUMFAwALJMLY2UjDUMlCwgjB0FzA==";

    // 2. Insert request
    const { data: sigReq, error: reqErr } = await supabaseAdmin.from("contract_signature_requests").insert({
        contract_id: contractId,
        event_id: contract.event_id,
        signature_provider: "assinafy",
        dispatch_status: "processing",
        internal_status: "pending_signature"
    }).select().single();

    if (reqErr) throw new Error("Insert failed: " + reqErr.message);

    // 3. Upload to Assinafy
    const binaryStr = atob(dummyPdf);
    const pdfBuffer = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        pdfBuffer[i] = binaryStr.charCodeAt(i);
    }
    
    const docData = await uploadDocument(`Contrato Evento - ${mockEvent.client_name || 'Teste'}.pdf`, pdfBuffer);

    // 4. Create signer & assignment
    const email = mockEvent.email || "teste@goatbar.com.br";
    const name = mockEvent.client_name || "Cliente Teste";

    const signerData = await createSigner(name, email);
    
    await createAssignment(docData.id, [{
        id: signerData.id,
        verification_method: "email",
        notification_methods: ["email"]
    }]);

    // 5. Update request
    await supabaseAdmin.from("contract_signature_requests").update({
        dispatch_status: "pending",
        external_document_id: docData.id,
        internal_status: "pending_signature"
    }).eq("id", sigReq.id);

    return new Response(JSON.stringify({ success: true, document: docData }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), { status: 500 });
  }
});
