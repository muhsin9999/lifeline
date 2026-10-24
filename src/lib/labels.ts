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

// The same reasons as a clause, for sentences: "failed on Oct 23 because the payment was declined".
const BECAUSE: Record<string, string> = {
  PAYMENT_DENIED: "PayPal denied the payment",
  PAYER_CANNOT_PAY: "the payment was declined",
  PAYER_ACCOUNT_RESTRICTED: "the donor's PayPal account is limited",
  SENDING_LIMIT_EXCEEDED: "the donor reached a PayPal sending limit",
  TRANSACTION_RECEIVING_LIMIT_EXCEEDED: "we reached a PayPal receiving limit",
  PAYEE_ACCOUNT_RESTRICTED: "our PayPal account is limited",
  CURRENCY_MISMATCH: "the currencies didn't match",
  INTERNAL_SERVER_ERROR: "PayPal had an error",
};

/**
 * A safety net for text the AI wrote: PayPal's codes ("PAYER_CANNOT_PAY", "ACTIVE") become plain words. The
 * prompt already asks for plain words; this also cleans diagnoses written before it did.
 */
export function plainWords(text: string) {
  return text
    .replace(/\s*\b(?:with|due to)?\s*(?:the\s+)?(?:PayPal(?:'s|’s)?\s+)?reason\s+code\s+([A-Z]+(?:_[A-Z]+)+)/gi, (_m, code: string) => ` because ${BECAUSE[code.toUpperCase()] ?? causeLabel(code.toUpperCase()).toLowerCase()}`)
    .replace(/\b[A-Z]{2,}(?:_[A-Z]{2,})+\b/g, (code) => causeLabel(code).toLowerCase())
    .replace(/\b(ACTIVE|SUSPENDED|CANCELLED|EXPIRED)\b/g, (w) => w.toLowerCase());
}

export function timeAgo(d: Date, now: Date) {
  const mins = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
