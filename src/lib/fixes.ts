// The fixes Lifeline can really make on PayPal (paypal-plan.md, Assumptions 2–3). PayPal can't move a billing
// date, so there is no "switch the date". Each fix names the PayPal call behind it.
export type FixId = "note" | "retry" | "pause" | "lower" | "forgive" | "cancel";

export const FIXES: Record<FixId, { label: string; does: (first: string, amount: string) => string; call: string }> = {
  note: { label: "Send a note", does: (first) => `Asks ${first} to update their payment in PayPal. PayPal retries on its own.`, call: "email" },
  retry: { label: "Retry the charge now", does: (_f, amount) => `Charges the ${amount} owed today instead of waiting for PayPal's retry.`, call: "captureSubscription" },
  pause: { label: "Pause for now", does: (first) => `Stops new charges until you resume. ${first} stays a donor.`, call: "suspendSubscription" },
  lower: { label: "Lower the gift", does: () => "Offers a smaller monthly amount. Starts with charges more than 10 days away.", call: "patchSubscription" },
  forgive: { label: "Forgive this month", does: (_f, amount) => `Clears the ${amount} owed, so the next gift starts fresh.`, call: "patchSubscription" },
  cancel: { label: "Cancel the gift", does: () => "Ends the monthly gift. Use only if the donor asked.", call: "cancelSubscription" },
};
