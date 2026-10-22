// Asks PayPal's webhook simulator to send one mock event to our webhook: node --env-file=.env.local scripts/spikes/simulate.mjs <EVENT_TYPE>
import "../../src/lib/net.ts";
const BASE = "https://api-m.sandbox.paypal.com";
const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
const { access_token } = await (await fetch(`${BASE}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" })).json();
const res = await fetch(`${BASE}/v1/notifications/simulate-event`, { method: "POST", headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ webhook_id: process.env.PAYPAL_WEBHOOK_ID, event_type: process.argv[2], resource_version: "2.0" }) });
const body = await res.json();
console.log(res.status, body.id ?? body.name, body.event_type ?? body.message ?? "");
