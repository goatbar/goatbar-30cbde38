import { describe, expect, it, vi } from "vitest";
import { deleteEventFromList } from "./event-list-deletion";

function dependencies(deleteEvent = vi.fn().mockResolvedValue(undefined)) {
  return {
    deleteEvent,
    reload: vi.fn().mockResolvedValue(undefined),
    showSuccess: vi.fn(),
    showError: vi.fn(),
  };
}

describe("deleteEventFromList", () => {
  it.each([
    ["uma solicitação sem versões/relacionamentos", "request-without-relations"],
    ["uma solicitação que possui evento e relacionamentos", "request-with-relations"],
  ])("exclui %s e recarrega a lista", async (_description, eventId) => {
    const deps = dependencies();
    await expect(deleteEventFromList(eventId, deps)).resolves.toBe(true);
    expect(deps.deleteEvent).toHaveBeenCalledWith(eventId);
    expect(deps.reload).toHaveBeenCalledOnce();
    expect(deps.showSuccess).toHaveBeenCalledWith("Orçamento excluído.");
    expect(deps.showError).not.toHaveBeenCalled();
  });

  it("exibe o erro real e não finge que a exclusão funcionou", async () => {
    const deps = dependencies(vi.fn().mockRejectedValue(new Error("foreign key violation")));
    await expect(deleteEventFromList("blocked", deps)).resolves.toBe(false);
    expect(deps.reload).not.toHaveBeenCalled();
    expect(deps.showSuccess).not.toHaveBeenCalled();
    expect(deps.showError).toHaveBeenCalledWith(
      "Não foi possível excluir o orçamento: foreign key violation",
    );
  });
});
