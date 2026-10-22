import { db, schema as s } from "@/db";
import { PayPalError } from "@/server/paypal/rest";
import { ingest, verifySignature, type WebhookEvent } from "@/server/paypal/webhooks";

// PayPal webhook receiver. Every delivery is checked against PayPal's signature before it is stored;
// unverified deliveries are logged for the webhook health panel and never touch a donor.
export async function POST(request: Request) {
  const raw = await request.text();
  let event: WebhookEvent;
  try {
    event = JSON.parse(raw) as WebhookEvent;
  } catch {
    await log(null, "INVALID_JSON", "rejected", "Body is not JSON");
    return Response.json({ ok: false }, { status: 400 });
  }

  let verification: string;
  let reason: string | null = null;
  try {
    ({ status: verification, reason } = await verifySignature(request.headers, raw));
  } catch (e) {
    // PayPal refused the verification request itself (forged or malformed headers): reject, don't retry.
    if (e instanceof PayPalError && e.status >= 400 && e.status < 500) {
      await log(event, "FAILURE", "rejected", `PayPal refused the verification request (${e.status}): ${e.message}`);
      return Response.json({ ok: false }, { status: 400 });
    }
    // PayPal itself didn't answer: ask it to retry later rather than drop the event.
    await log(event, "ERROR", "retry", (e as Error).message);
    return Response.json({ ok: false }, { status: 503 });
  }
  if (verification !== "SUCCESS") {
    await log(event, verification, "rejected", reason ?? "PayPal did not confirm the signature");
    return Response.json({ ok: false }, { status: 400 });
  }

  const { outcome } = await ingest(event);
  await log(event, verification, outcome, null);
  return Response.json({ ok: true, outcome });
}

async function log(event: WebhookEvent | null, verification: string, outcome: string, error: string | null) {
  await db.insert(s.webhookDeliveries).values({ paypalEventId: event?.id ?? null, type: event?.event_type ?? null, verification, outcome, error });
}
