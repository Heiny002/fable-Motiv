/** YYYY-MM-DD for the user's local calendar day, optionally offset by N days. */
export function userLocalDate(timezone: string, offsetDays = 0): string {
  const base = new Date(Date.now() + offsetDays * 86_400_000);
  // en-CA formats as YYYY-MM-DD.
  return base.toLocaleDateString("en-CA", { timeZone: timezone });
}
