// Plain words for PayPal's codes and for times, shared by pages and the agent.

// PayPal's ReasonCode values for a failed subscription payment (paypal-plan.md). PayPal never tells a merchant
// the donor's card or bank, so the labels describe what PayPal said, not what we can't see.
const CAUSE: Record<string, string> = {
  PAYMENT_DENIED: "Payment denied",
  PAYER_CANNOT_PAY: "Payment declined",
  PAYER_ACCOUNT_RESTRICTED: "Donor's PayPal limited",
  SENDING_LIMIT_EXCEEDED: "Over sending limit",
  TRANSACTION_RECEIVING_LIMIT_EXCEEDED: "Over our receiving limit",
  PAYEE_ACCOUNT_RESTRICTED: "Our PayPal limited",
  CURRENCY_MISMATCH: "Currency mismatch",
  INTERNAL_SERVER_ERROR: "PayPal error",
};
export const causeLabel = (code: string | null) => (code ? (CAUSE[code] ?? code.toLowerCase().replaceAll("_", " ")) : "Payment failed");

export function timeAgo(d: Date, now: Date) {
  const mins = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
