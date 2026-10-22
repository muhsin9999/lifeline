// The one APIMatic PayPal SDK client for the process (paypal-plan.md, Host and client). Built on first use, so a
// missing secret fails loudly at the first PayPal call's startup check instead of as a silent 401.
import "server-only";
import "@/lib/net";
import { PaypalClient } from "paypal";

let client: PaypalClient | undefined;

export function paypalSdk() {
  if (client) return client;
  // The SDK knows one host, the sandbox. Lifeline is sandbox-only, so any other intent is a configuration error.
  const env = process.env.PAYPAL_ENV;
  if (env && env !== "sandbox") throw new Error(`PAYPAL_ENV=${env} is not supported: Lifeline runs on the PayPal sandbox only`);
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  // An unset credential is not an SDK error (it sends none and PayPal answers 401), so check here.
  if (!clientId || !clientSecret) throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set");
  client = new PaypalClient({
    oauth2: { clientId, clientSecret },
    // Request bodies carry donor names and emails: logging stays off, and is set explicitly so the
    // PAYPAL_CLIENT_LOG environment variable can't switch it on.
    logging: { level: "off" },
  });
  return client;
}
