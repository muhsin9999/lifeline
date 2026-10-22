// One mapping from a PayPal SDK failure to what Lifeline tells the officer (paypal-plan.md §1b.4). Every
// Subscriptions write declares the same SubscriptionError body on every arm, so the reason is read from that
// shared model after narrowing, never by switching on an arm name across operations.
import { ApiError, PaypalError } from "paypal";

export type PayPalOutcome =
  /** PayPal refused the request for a reason the officer can act on (a 4xx other than 401/403/429). */
  | { kind: "refused"; status: number; reason: string; debugId: string | null }
  /** Our side: credentials (401/403), quota (429) or PayPal itself (5xx). */
  | { kind: "unavailable"; status: number; message: string; debugId: string | null }
  /** No answer: on a write, PayPal may have acted, so the caller must re-read before saying anything. */
  | { kind: "no_response" }
  /** Nothing was sent: a credential couldn't be obtained or a value wouldn't encode. Safe to retry later. */
  | { kind: "never_sent"; message: string }
  /** PayPal answered 2xx but the body couldn't be read: like no_response, the outcome is unknown. */
  | { kind: "unreadable"; status: number };

type ErrorBody = { name?: string; message?: string; debugId?: string; details?: { issue?: string; description?: string }[] };

function bodyOf(err: ApiError): ErrorBody | null {
  const p = err.payload as { kind: string; body?: unknown; rawBody?: ArrayBuffer };
  if (p.body && typeof p.body === "object") return p.body as ErrorBody;
  if (p.rawBody) {
    try {
      return JSON.parse(new TextDecoder().decode(p.rawBody)) as ErrorBody;
    } catch {
      return null;
    }
  }
  return null;
}

/** Turns any SDK failure into an outcome. Anything outside the SDK's family (a bug, an abort) is rethrown. */
export function outcomeOf(err: unknown): PayPalOutcome {
  if (!(err instanceof PaypalError)) throw err;
  switch (err.kind) {
    case "api": {
      const body = bodyOf(err as ApiError);
      const debugId = body?.debugId ?? null;
      const status = (err as ApiError).status;
      if (status === 401 || status === 403) return { kind: "unavailable", status, message: "Lifeline couldn’t sign in to PayPal.", debugId };
      if (status === 429) return { kind: "unavailable", status, message: "PayPal is busy. Try again in a minute.", debugId };
      if (status >= 500 || status < 400) return { kind: "unavailable", status, message: "PayPal had a problem. Try again shortly.", debugId };
      const d = body?.details?.[0];
      const reason = d?.description ?? d?.issue ?? body?.message ?? `PayPal refused the request (${status}).`;
      return { kind: "refused", status, reason, debugId };
    }
    case "decode":
      return { kind: "unreadable", status: err.status };
    case "connection":
    case "timeout":
      return { kind: "no_response" };
    case "auth":
      return { kind: "never_sent", message: "Lifeline couldn’t get a PayPal sign-in token. Check the app’s credentials." };
    case "encode":
      return { kind: "never_sent", message: "Lifeline built a request PayPal’s SDK rejected before sending. This is a bug." };
  }
}

/** The HTTP status Lifeline's own routes answer with for an outcome (paypal-plan.md §1b.4). */
export function httpStatusOf(o: PayPalOutcome) {
  switch (o.kind) {
    case "refused":
      return o.status;
    case "unavailable":
      return o.status === 429 ? 503 : 502;
    case "no_response":
    case "unreadable":
      return 502;
    case "never_sent":
      return 500;
  }
}
