import { describe, expect, it } from "vitest";

import { extractClientEventTime } from "./contract-service";

describe("extractClientEventTime", () => {
  it("extrai o horário do resumo enviado pelo cliente", () => {
    const notes = [
      "Data do Evento: 23/01/2027",
      "Horário: 16:00",
      "Convidados: 200",
      "Forma de Pagamento: 30% na assinatura",
    ].join("\n");

    expect(extractClientEventTime(notes)).toBe("16:00");
  });

  it("aceita o horário salvo em notas estruturadas", () => {
    expect(extractClientEventTime({ horario: " 18:30 " })).toBe("18:30");
  });

  it("retorna vazio quando o cliente não informou o horário", () => {
    expect(extractClientEventTime("Convidados: 200")).toBe("");
  });
});
