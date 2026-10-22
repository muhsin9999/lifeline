// PayPal webhooks: verify with PayPal, store once, translate to plain English, and open a rescue for a failed gift.
import "server-only";
import { X509Certificate } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { describe, failedPaymentOf, subscriptionIdOf, type WebhookEvent } from "@/lib/paypal-events";
import { checkSignature, trustedCertUrl } from "@/lib/paypal-signature";
import { paypal } from "./rest";

export type { WebhookEvent };

const HEADERS = ["paypal-auth-algo", "paypal-cert-url", "paypal-transmission-id", "paypal-transmission-sig", "paypal-transmission-time"] as const;

const certs = new Map<string, string>();

async function cert(url: string) {
  const hit = certs.get(url);
  if (hit) return hit;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`PayPal certificate fetch failed (${res.status})`);
  const pem = await res.text();
  const x = new X509Certificate(pem);
  if (new Date(x.validTo) < new Date()) throw new Error("PayPal signing certificate has expired");
  certs.set(url, pem);
  return pem;
}

/**
 * Confirms a delivery really came from PayPal for our webhook. First the offline check on the exact bytes PayPal
 * sent (PayPal's certificate, fetched only from its own API hosts); if that can't decide, PayPal's own
 * verify-webhook-signature API, given the raw event so nothing is re-serialised. Returns SUCCESS or FAILURE.
 */
export async function verifySignature(headers: Headers, raw: string) {
  const missing = HEADERS.filter((h) => !headers.get(h));
  if (missing.length) return { status: "FAILURE" as const, reason: `missing ${missing.join(", ")}` };
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  // Without our webhook id nothing can be verified, so nothing is accepted (PayPal retries later).
  if (!webhookId) return { status: "FAILURE" as const, reason: "PAYPAL_WEBHOOK_ID is not set" };
  const get = (h: (typeof HEADERS)[number]) => headers.get(h)!;
  const certUrl = get("paypal-cert-url");
  if (!trustedCertUrl(certUrl)) return { status: "FAILURE" as const, reason: "certificate is not on a PayPal host" };
  if (/^SHA256withRSA$/i.test(get("paypal-auth-algo"))) {
    try {
      const ok = checkSignature({ transmissionId: get("paypal-transmission-id"), time: get("paypal-transmission-time"), webhookId, raw, signature: get("paypal-transmission-sig"), certPem: await cert(certUrl) });
      if (ok) return { status: "SUCCESS" as const, reason: null, method: "certificate" };
    } catch (e) {
      console.warn("Offline webhook check failed, asking PayPal:", (e as Error).message);
    }
  }
  const fields = {
    auth_algo: get("paypal-auth-algo"),
    cert_url: certUrl,
    transmission_id: get("paypal-transmission-id"),
    transmission_sig: get("paypal-transmission-sig"),
    transmission_time: get("paypal-transmission-time"),
    webhook_id: webhookId,
  };
  // The event goes in as PayPal sent it, spliced into the JSON, not parsed and re-stringified.
  const body = `${JSON.stringify(fields).slice(0, -1)},"webhook_event":${raw}}`;
  const result = await paypal<{ verification_status: "SUCCESS" | "FAILURE" }>("POST", "/v1/notifications/verify-webhook-signature", { rawBody: body });
  return { status: result.verification_status, reason: result.verification_status === "SUCCESS" ? null : "PayPal did not confirm the signature", method: "api" };
}

export type IngestOutcome = "stored" | "duplicate" | "unmatched";

const STATUS_AFTER: Record<string, string> = {
  "BILLING.SUBSCRIPTION.ACTIVATED": "ACTIVE",
  "BILLING.SUBSCRIPTION.RE-ACTIVATED": "ACTIVE",
  "BILLING.SUBSCRIPTION.SUSPENDED": "SUSPENDED",
  "BILLING.SUBSCRIPTION.CANCELLED": "CANCELLED",
  "BILLING.SUBSCRIPTION.EXPIRED": "EXPIRED",
};

/** Stores a verified event exactly once, updates the donor, and opens a rescue for a failed gift. */
export async function ingest(event: WebhookEvent, opts: { simulated?: boolean } = {}): Promise<{ outcome: IngestOutcome; failureId?: string }> {
  if (await db.query.events.findFirst({ where: eq(s.events.paypalEventId, event.id), columns: { id: true } })) return { outcome: "duplicate" };

  const subscriptionId = subscriptionIdOf(event);
  const donor = subscriptionId ? await db.query.donors.findFirst({ where: eq(s.donors.paypalSubscriptionId, subscriptionId) }) : null;
  const at = event.create_time ? new Date(event.create_time) : new Date();
  let failureId: string | undefined;

  if (donor) {
    const status = STATUS_AFTER[event.event_type];
    if (status) await db.update(s.donors).set({ status }).where(eq(s.donors.id, donor.id));
    if (event.event_type === "PAYMENT.SALE.COMPLETED") await db.update(s.donors).set({ lastPaymentAt: at }).where(eq(s.donors.id, donor.id));
    if (event.event_type === "BILLING.SUBSCRIPTION.PAYMENT.FAILED") {
      const f = failedPaymentOf(event);
      const [row] = await db
        .insert(s.failures)
        .values({
          orgId: donor.orgId,
          donorId: donor.id,
          paypalEventId: event.id,
          amountCents: f?.amountCents ?? donor.amountCents,
          reasonCode: f?.reasonCode ?? null,
          failedAt: f ? new Date(f.time) : at,
          nextRetryAt: f?.nextRetryAt ? new Date(f.nextRetryAt) : null,
        })
        .onConflictDoNothing({ target: s.failures.paypalEventId })
        .returning({ id: s.failures.id });
      failureId = row?.id;
      await db.update(s.donors).set({ failedPaymentsCount: donor.failedPaymentsCount + 1 }).where(eq(s.donors.id, donor.id));
    }
  }

  const inserted = await db
    .insert(s.events)
    .values({
      orgId: donor?.orgId ?? null,
      donorId: donor?.id ?? null,
      paypalEventId: event.id,
      type: event.event_type,
      summary: describe(event, donor?.name),
      verified: !opts.simulated,
      simulated: !!opts.simulated,
      payload: event as unknown as Record<string, unknown>,
      occurredAt: at,
    })
    .onConflictDoNothing({ target: s.events.paypalEventId })
    .returning({ id: s.events.id });
  if (!inserted.length) return { outcome: "duplicate" };
  return { outcome: donor ? "stored" : "unmatched", ...(failureId && { failureId }) };
}
