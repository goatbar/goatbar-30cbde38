export function calculateEndTime(startTime: string | null | undefined, durationHours: number | null | undefined): string {
  if (!startTime || durationHours == null) {
    return "";
  }
  try {
    const parts = startTime.split(":");
    const startH = parseInt(parts[0], 10);
    const startM = parseInt(parts[1], 10);
    if (isNaN(startH) || isNaN(startM)) return "";

    const totalMinutes = startH * 60 + startM + Math.round(durationHours * 60);
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    const formatTwo = (n: number) => String(n).padStart(2, "0");
    return `${formatTwo(endH)}:${formatTwo(endM)}`;
  } catch (err) {
    console.warn("Erro ao calcular horário final:", err);
    return "";
  }
}

export function calculateFinalPaymentDate(eventDate: string | null | undefined): string {
  if (!eventDate) {
    return "";
  }
  try {
    const evDate = new Date(eventDate + "T12:00:00"); 
    if (isNaN(evDate.getTime())) return "";

    evDate.setDate(evDate.getDate() - 7);
    return evDate.toLocaleDateString("pt-BR");
  } catch (err) {
    console.warn("Erro ao calcular data final de pagamento:", err);
    return "";
  }
}
