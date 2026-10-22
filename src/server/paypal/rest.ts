// Plain PayPal REST client for the calls the SDK has no resource for: catalog products (seed only) and
// webhook verification/registration. Everything on subscriptions goes through the SDK (sdk.ts, paypal-plan.md).
import "server-only";
import "@/lib/net";

// Sandbox only (paypal-plan.md, Host): sdk.ts refuses any other PAYPAL_ENV.
const BASE = "https://api-m.sandbox.paypal.com";
let cached: { value: string; exp: number } | undefined;

export class PayPalError extends Error {
  constructor(public status: number, public debugId: string | null, public body: unknown, message: string) {
    super(message);
  }
}

async function token() {
  if (cached && cached.exp > Date.now()) return cached.value;
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const body = (await res.json()) as { access_token: string; expires_in: number };
  if (!res.ok) throw new PayPalError(res.status, res.headers.get("paypal-debug-id"), body, "PayPal sign-in failed");
  cached = { value: body.access_token, exp: Date.now() + (body.expires_in - 60) * 1000 };
  return cached.value;
}

export async function paypal<T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, init: { body?: unknown; rawBody?: string; headers?: Record<string, string> } = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", Prefer: "return=representation", ...init.headers },
    body: init.rawBody ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
    cache: "no-store",
  });
  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const err = json as { message?: string; details?: { field?: string; issue?: string; description?: string }[] } | null;
    const detail = err?.details?.[0];
    const message = [err?.message ?? `PayPal ${method} ${path} failed`, detail ? `(${[detail.field, detail.issue ?? detail.description].filter(Boolean).join(": ")})` : null].filter(Boolean).join(" ");
    throw new PayPalError(res.status, res.headers.get("paypal-debug-id"), json, message);
  }
  return json as T;
}
