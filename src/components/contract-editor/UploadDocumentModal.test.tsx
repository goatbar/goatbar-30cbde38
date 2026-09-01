// @vitest-environment jsdom
import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { UploadDocumentModal } from "./UploadDocumentModal";
import { Button } from "@/components/ui/button";

// Mock do Supabase para o teste de UI do modal
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          neq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    }),
  },
}));

function TestWrapper() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setOpen(true)}>
        SELECIONAR ARQUIVO DE CONTRATO
      </Button>
      <UploadDocumentModal
        open={open}
        onOpenChange={setOpen}
        eventId="event-test-123"
        onSuccess={() => {}}
      />
    </div>
  );
}

describe("UploadDocumentModal UI Wiring", () => {
  it("abre o modal com sucesso ao clicar no botão de upload", () => {
    render(<TestWrapper />);

    // Inicialmente o modal não deve estar visível
    expect(screen.queryByText("Upload de Documentos Contratuais & Anexos")).toBeNull();

    // Clica no botão "SELECIONAR ARQUIVO DE CONTRATO"
    const uploadButton = screen.getByText("SELECIONAR ARQUIVO DE CONTRATO");
    fireEvent.click(uploadButton);

    // O modal deve ser exibido com seu título e área de drop
    expect(screen.getByText("Upload de Documentos Contratuais & Anexos")).not.toBeNull();
    expect(screen.getByText("Clique aqui para selecionar 1 ou mais arquivos")).not.toBeNull();
  });
});
