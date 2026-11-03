// Shared formatting for amounts and dates.

export function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
}

// A date from an earlier year carries its year ("Dec 25, 2025"), so a long gift history is never ambiguous.
export const day = (d: Date | string | null | undefined) => {
  if (!d) return null;
  const date = new Date(d);
  const past = date.getUTCFullYear() !== new Date().getUTCFullYear();
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", ...(past && { year: "numeric" }), timeZone: "UTC" }).format(date);
};

/** Larkhaven is a US food bank, so its screens show US Eastern time. */
export const ORG_TIME_ZONE = "America/New_York";
export const hourInOrg = (d: Date) => Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: ORG_TIME_ZONE }).format(d));

/** The sandbox donors are on a $1 daily test plan (so a failure can be watched in a day); real donors give monthly. */
export const giftLabel = (daily: boolean) => (daily ? "Daily test gift" : "Monthly gift");
