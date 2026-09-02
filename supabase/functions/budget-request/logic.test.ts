import { describe, expect, it } from "vitest";
import {
  generateSecureToken,
  getLinkState,
  isValidUuid,
  normalizeBrazilianPhone,
  parseWeddingCoupleName,
  sanitizePublicDrinks,
  validatePublicBudgetPayload,
  validatePublicLeadContact,
  validatePublicLeadContext,
} from "./logic.ts";

const valid = {
  client_name: "Mariana",
  event_name: "João e Maria",
  phone: "(11) 99999-9999",
  date: "2026-10-17",
  event_type: "Casamento",
  guests: 180,
  duration_hours: 5,
};

describe("budget request backend", () => {
  it("gera tokens seguros e únicos", () => {
    const first = generateSecureToken();
    const second = generateSecureToken();
    expect(first).toHaveLength(64);
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[a-f0-9]+$/);
  });

  it("deriva estados sem confiar no browser", () => {
    expect(getLinkState({ status: "ACTIVE" })).toBe("ACTIVE");
    expect(getLinkState({ status: "ACTIVE", expires_at: "2020-01-01" })).toBe("EXPIRED");
    expect(getLinkState({ status: "CANCELLED" })).toBe("CANCELLED");
    expect(getLinkState({ status: "USED", event_id: "x" })).toBe("USED");
  });

  it("aceita payload canônico", () => expect(validatePublicBudgetPayload(valid).guests).toBe(180));
  it("rejeita campo obrigatório ausente", () =>
    expect(() => validatePublicBudgetPayload({ ...valid, client_name: "" })).toThrow());
  it("rejeita campo administrativo", () =>
    expect(() => validatePublicBudgetPayload({ ...valid, status: "confirmado" })).toThrow(
      /não permitidos/,
    ));

  describe("parseWeddingCoupleName", () => {
    it("1. separa 'João e Maria' corretamente", () => {
      expect(parseWeddingCoupleName("João e Maria")).toEqual({
        groom_name: "João",
        bride_name: "Maria",
      });
    });

    it("2. separa 'João da Silva & Maria Oliveira' sem quebrar nomes compostos", () => {
      expect(parseWeddingCoupleName("João da Silva & Maria Oliveira")).toEqual({
        groom_name: "João da Silva",
        bride_name: "Maria Oliveira",
      });
    });

    it("3. '+' funciona", () => {
      expect(parseWeddingCoupleName("João + Maria")).toEqual({
        groom_name: "João",
        bride_name: "Maria",
      });
    });

    it("4. '/' funciona", () => {
      expect(parseWeddingCoupleName("João / Maria")).toEqual({
        groom_name: "João",
        bride_name: "Maria",
      });
    });

    it("5. rejeita quando há mais de 2 partes ou quando não há separador", () => {
      expect(parseWeddingCoupleName("João e Maria e Pedro")).toBeNull();
      expect(parseWeddingCoupleName("Casamento João")).toBeNull();
      expect(parseWeddingCoupleName("")).toBeNull();
      expect(parseWeddingCoupleName("   ")).toBeNull();
      expect(parseWeddingCoupleName("João & ")).toBeNull();
    });
  });

  it("normaliza o nome e não infere noivo/noiva pela ordem dos nomes", () => {
    const payload = validatePublicBudgetPayload({
      ...valid,
      event_name: "João e Maria",
    });
    expect(payload.event_name).toBe("João & Maria");
    expect(payload.groom_name).toBe("");
    expect(payload.bride_name).toBe("");
  });

  it("2. 'João & Maria' -> correto", () => {
    const payload = validatePublicBudgetPayload({
      ...valid,
      event_name: "João da Silva & Maria Oliveira",
    });
    expect(payload.event_name).toBe("João da Silva & Maria Oliveira");
    expect(payload.groom_name).toBe("");
    expect(payload.bride_name).toBe("");
  });

  it("3. 'João / Maria' e 'João + Maria' -> correto", () => {
    const slash = validatePublicBudgetPayload({
      ...valid,
      event_name: "João / Maria",
    });
    expect(slash.groom_name).toBe("");
    expect(slash.bride_name).toBe("");

    const plus = validatePublicBudgetPayload({
      ...valid,
      event_name: "João + Maria",
    });
    expect(plus.groom_name).toBe("");
    expect(plus.bride_name).toBe("");
  });

  it("preserva noivo e noiva vindos dos campos explicitamente mapeados", () => {
    const payload = validatePublicBudgetPayload({
      ...valid,
      event_name: "Larissa e Marcos",
      groom_name: "Marcos",
      bride_name: "Larissa",
    });
    expect(payload.event_name).toBe("Larissa & Marcos");
    expect(payload.groom_name).toBe("Marcos");
    expect(payload.bride_name).toBe("Larissa");
  });

  it("4. casamento com apenas um nome (ex: 'João') -> rejeita com mensagem amigável", () => {
    expect(() =>
      validatePublicBudgetPayload({
        ...valid,
        event_name: "João",
      }),
    ).toThrow("Informe o nome do casal no formato 'Nome e Nome'.");

    expect(() =>
      validatePublicBudgetPayload({
        ...valid,
        event_name: "",
      }),
    ).toThrow("Nome do casal é obrigatório.");
  });

  it("não exige nem tenta popular noivos em outro tipo de evento", () => {
    const payload = validatePublicBudgetPayload({
      ...valid,
      event_type: "Corporativo",
      event_name: "Convenção Anual 2026",
    });
    expect(payload.event_name).toBe("Convenção Anual 2026");
    expect(payload.groom_name).toBe("");
    expect(payload.bride_name).toBe("");
  });

  it.each([0, 1, 3])("aceita seleção opcional com %i drinks", (count) => {
    const ids = Array.from({ length: count }, (_, index) => `drink-${index}`);
    expect(
      validatePublicBudgetPayload({ ...valid, requested_drink_ids: ids }).requested_drink_ids,
    ).toEqual(ids);
  });

  it("rejeita duração inválida", () =>
    expect(() => validatePublicBudgetPayload({ ...valid, duration_hours: 0 })).toThrow(/Duração/));
  it("rejeita IDs de drinks inválidos", () =>
    expect(() => validatePublicBudgetPayload({ ...valid, requested_drink_ids: [123] })).toThrow(
      /IDs/,
    ));

  it("sanitiza e filtra o catálogo sem vazar campos financeiros", () => {
    const rows = [
      {
        id: "public",
        nome: "Mule",
        descricao: "Refrescante",
        imagem: "https://image",
        show_in_public_menu: true,
        modality_config: { evento: { active: true } },
        custo_unitario: 99,
        insumos: [{ nome: "Limão", custo: 12 }],
      },
      {
        id: "private",
        nome: "Interno",
        show_in_public_menu: false,
        modality_config: { evento: { active: true } },
      },
      {
        id: "inactive",
        nome: "Inativo",
        show_in_public_menu: true,
        modality_config: { evento: { active: false } },
      },
    ];
    const result = sanitizePublicDrinks(rows);
    expect(result).toEqual([
      {
        id: "public",
        name: "Mule",
        description: "Refrescante",
        image: "https://image",
        ingredients: ["Limão"],
      },
    ]);
    expect(result[0]).not.toHaveProperty("custo_unitario");
    expect(JSON.stringify(result)).not.toContain("12");
  });

  describe("public lead funnel logic", () => {
    it("normaliza telefones brasileiros", () => {
      expect(normalizeBrazilianPhone("11999998888")).toBe("5511999998888");
      expect(normalizeBrazilianPhone("(11) 99999-8888")).toBe("5511999998888");
      expect(normalizeBrazilianPhone("+55 11 99999-8888")).toBe("5511999998888");
      expect(normalizeBrazilianPhone("5511999998888")).toBe("5511999998888");
    });

    it("valida UUIDs v4 corretamente", () => {
      expect(isValidUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
      expect(isValidUuid("c73bcdcc-2669-4bf6-81d3-e4ae73fb11be")).toBe(true);
      expect(isValidUuid("invalid-uuid")).toBe(false);
      expect(isValidUuid("")).toBe(false);
      expect(isValidUuid(null)).toBe(false);
    });

    it("valida contexto do lead público", () => {
      const validContext = {
        visitor_id: "c73bcdcc-2669-4bf6-81d3-e4ae73fb11be",
        session_id: "123e4567-e89b-12d3-a456-426614174000",
        utm_source: "instagram",
        landing_page: "/orcamento",
      };
      const validated = validatePublicLeadContext(validContext);
      expect(validated.visitor_id).toBe("c73bcdcc-2669-4bf6-81d3-e4ae73fb11be");
      expect(validated.session_id).toBe("123e4567-e89b-12d3-a456-426614174000");
      expect(validated.utm_source).toBe("instagram");

      expect(() => validatePublicLeadContext({ ...validContext, visitor_id: "invalid" })).toThrow(
        /Identificadores/,
      );
    });

    it("valida contato do lead público para captura em background", () => {
      const validContact = {
        client_name: "Mariana Silva",
        phone: "(11) 98888-7777",
        email: "mariana@example.com",
      };
      const validated = validatePublicLeadContact(validContact);
      expect(validated.client_name).toBe("Mariana Silva");
      expect(validated.phone).toBe("(11) 98888-7777");
      expect(validated.email).toBe("mariana@example.com");

      expect(() => validatePublicLeadContact({ ...validContact, client_name: "M" })).toThrow(
        /Nome/,
      );
      expect(() => validatePublicLeadContact({ ...validContact, phone: "123" })).toThrow(
        /WhatsApp/,
      );
      expect(() => validatePublicLeadContact({ ...validContact, email: "invalid-email" })).toThrow(
        /E-mail/,
      );
    });
  });
});
