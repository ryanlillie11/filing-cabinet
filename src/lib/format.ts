export function money(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

export function daysUntil(iso: string): number {
  const target = new Date(iso + "T00:00:00");
  return Math.ceil((target.getTime() - Date.now()) / 86_400_000);
}
