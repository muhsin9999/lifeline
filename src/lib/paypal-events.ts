// Plain-English descriptions of PayPal subscription webhook events, shared by the webhook route and tests.
import { money } from "./format";

export type WebhookEvent = { id: string; event_type: string; create_time?: string; resource_type?: string; summary?: string; resource: Record<string, unknown> };

type Amount = { value?: string; currency_code?: string };
export const cents = (a?: Amount | null) => (a?.value ? Math.round(Number(a.value) * 100) : null);
const amountText = (a?: Amount | null) => (cents(a) !== null ? money(cents(a)!, a?.currency_code ?? "USD") : "");

type SubscriptionResource = {
  id?: string;
  status?: string;
  billing_agreement_id?: string;
  amount?: { total?: string; currency?: string };
  billing_info?: { last_failed_payment?: { amount?: Amount; time?: string; reason_code?: string; next_payment_retry_time?: string }; failed_payments_count?: number; outstanding_balance?: Amount };
};

/** The PayPal subscription an event is about: the resource itself for BILLING.SUBSCRIPTION.*, or the sale's agreement. */
export function subscriptionIdOf(event: WebhookEvent) {
  const r = event.resource as SubscriptionResource;
  if (event.event_type.startsWith("BILLING.SUBSCRIPTION.")) return r.id ?? null;
  if (event.event_type.startsWith("PAYMENT.SALE.")) return r.billing_agreement_id ?? null;
  return null;
}

/** The failed payment carried by BILLING.SUBSCRIPTION.PAYMENT.FAILED, if the event has one. */
export function failedPaymentOf(event: WebhookEvent) {
  const f = (event.resource as SubscriptionResource).billing_info?.last_failed_payment;
  if (!f?.amount || !f.time) return null;
  return { amountCents: cents(f.amount)!, currency: f.amount.currency_code ?? "USD", time: f.time, reasonCode: f.reason_code ?? null, nextRetryAt: f.next_payment_retry_time ?? null };
}

/** Plain-English line for the timeline. Unknown types fall back to a readable version of the name. */
export function describe(event: WebhookEvent, donorName?: string | null) {
  const r = event.resource as SubscriptionResource;
  const who = donorName ?? "A donor";
  switch (event.event_type) {
    case "BILLING.SUBSCRIPTION.ACTIVATED":
      return `${who} started monthly giving`;
    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
      const amount = amountText(r.billing_info?.last_failed_payment?.amount);
      return amount ? `${who}’s gift of ${amount} failed` : `${who}’s monthly gift failed`;
    }
    case "BILLING.SUBSCRIPTION.SUSPENDED":
      return `${who}’s monthly gift was paused`;
    case "BILLING.SUBSCRIPTION.CANCELLED":
      return `${who} stopped monthly giving`;
    case "BILLING.SUBSCRIPTION.EXPIRED":
      return `${who}’s monthly gift ended`;
    case "BILLING.SUBSCRIPTION.RE-ACTIVATED":
      return `${who}’s monthly gift resumed`;
    case "BILLING.SUBSCRIPTION.UPDATED":
      return `${who}’s monthly gift was updated`;
    case "PAYMENT.SALE.COMPLETED":
      return `${who} gave ${amountText(r.amount?.total ? { value: r.amount.total, currency_code: r.amount.currency } : null)}`.trim();
    default:
      return event.summary ?? event.event_type.toLowerCase().replaceAll(/[._]/g, " ");
  }
}
