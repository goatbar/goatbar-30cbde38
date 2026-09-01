export type EventListDeletionDependencies = {
  deleteEvent: (eventId: string) => Promise<void>;
  reload: () => Promise<unknown>;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
};

export async function deleteEventFromList(
  eventId: string,
  dependencies: EventListDeletionDependencies,
): Promise<boolean> {
  try {
    await dependencies.deleteEvent(eventId);
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
