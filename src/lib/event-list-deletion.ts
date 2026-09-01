export type EventListDeletionDependencies = {
  deleteRequest: (eventId: string) => Promise<void>;
  removeFromList: (eventId: string) => void;
  reload: () => Promise<unknown>;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
};

export async function deleteEventFromList(
  eventId: string,
  dependencies: EventListDeletionDependencies,
): Promise<boolean> {
  try {
    await dependencies.deleteRequest(eventId);
    // Update the card and counter synchronously after the database confirms the
    // deletion; the refetch below only reconciles the local state.
    dependencies.removeFromList(eventId);
    await dependencies.reload();
    dependencies.showSuccess("Orçamento excluído.");
    return true;
  } catch (error) {
    console.error("Erro ao excluir orçamento:", error);
    dependencies.showError(
      error instanceof Error
        ? `Não foi possível excluir o orçamento: ${error.message}`
        : "Não foi possível excluir o orçamento.",
    );
    return false;
  }
}
