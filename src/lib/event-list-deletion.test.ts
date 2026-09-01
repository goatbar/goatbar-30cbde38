import { describe, expect, it, vi } from "vitest";
import { deleteEventFromList } from "./event-list-deletion";

function dependencies(deleteRequest = vi.fn().mockResolvedValue(undefined)) {
  return {
    deleteRequest,
    removeFromList: vi.fn(),
    reload: vi.fn().mockResolvedValue(undefined),
    showSuccess: vi.fn(),
    showError: vi.fn(),
  };
}

describe("deleteEventFromList", () => {
  it.each([
    ["uma solicitação sem evento relacionado", "request-without-event"],
    ["uma solicitação com evento relacionado descartável", "request-with-safe-event"],
  ])("exclui %s e recarrega a lista", async (_description, eventId) => {
    const deps = dependencies();
    await expect(deleteEventFromList(eventId, deps)).resolves.toBe(true);
    expect(deps.deleteRequest).toHaveBeenCalledWith(eventId);
    expect(deps.removeFromList).toHaveBeenCalledWith(eventId);
    expect(deps.reload).toHaveBeenCalledOnce();
    expect(deps.showSuccess).toHaveBeenCalledWith("Orçamento excluído.");
    expect(deps.showError).not.toHaveBeenCalled();
  });

  it("bloqueia com segurança quando há dependências e exibe o erro real", async () => {
    const deps = dependencies(
      vi.fn().mockRejectedValue(new Error("A solicitação possui dados relacionados: contracts.")),
    );
    await expect(deleteEventFromList("blocked", deps)).resolves.toBe(false);
    expect(deps.reload).not.toHaveBeenCalled();
    expect(deps.removeFromList).not.toHaveBeenCalled();
    expect(deps.showSuccess).not.toHaveBeenCalled();
    expect(deps.showError).toHaveBeenCalledWith(
      "Não foi possível excluir o orçamento: A solicitação possui dados relacionados: contracts.",
    );
  });

  it("remove o card e atualiza o contador antes do refetch", async () => {
    const visibleIds = ["request-1", "request-2"];
    let countSeenDuringReload = -1;
    const deps = dependencies();
    deps.removeFromList.mockImplementation((id) => visibleIds.splice(visibleIds.indexOf(id), 1));
    deps.reload.mockImplementation(async () => {
      countSeenDuringReload = visibleIds.length;
    });

    await deleteEventFromList("request-1", deps);

    expect(visibleIds).toEqual(["request-2"]);
    expect(countSeenDuringReload).toBe(1);
  });
});
