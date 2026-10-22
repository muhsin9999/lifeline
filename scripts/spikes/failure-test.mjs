// Step 0 kill test: can the sandbox produce a REAL failed subscription payment?
// Creates (once) a test product + a DAILY $1 plan, and two subscriptions whose approval links the donors open:
//   - "healthy": approved by a donor with PayPal balance (control)
//   - "failing": approved by a $0-balance donor paying by card, who then removes the card so day 2 fails
// Usage: node --env-file=.env.local scripts/spikes/failure-test.mjs create | status
import "../../src/lib/net.ts";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { PaypalClient } from "paypal";

const STATE = "scripts/spikes/.failure-test.json";
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
const save = () => writeFileSync(STATE, JSON.stringify(state, null, 2));
const c = new PaypalClient({ oauth2: { clientId: process.env.PAYPAL_CLIENT_ID, clientSecret: process.env.PAYPAL_CLIENT_SECRET }, logging: { level: "off" } });

async function rest(method, path, body) {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const t = await (await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" })).json();
  const res = await fetch(`https://api-m.sandbox.paypal.com${path}`, { method, headers: { Authorization: `Bearer ${t.access_token}`, "Content-Type": "application/json", "PayPal-Request-Id": `lifeline-failtest-${path}` }, body: body && JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${json.message ?? ""}`);
  return json;
}

if (process.argv[2] === "create") {
  state.productId ??= (await rest("POST", "/v1/catalogs/products", { name: "Lifeline failure test", type: "SERVICE", category: "CHARITY" })).id;
  if (!state.planId) {
    const plan = await c.subscriptions.createBillingPlan({
      prefer: "return=representation",
      payPalRequestId: "lifeline-failtest-plan-daily",
      body: {
        productId: state.productId,
        name: "Failure test: $1 every day",
        billingCycles: [{ frequency: { intervalUnit: "DAY", intervalCount: 1 }, tenureType: "REGULAR", sequence: 1, totalCycles: 0, pricingScheme: { fixedPrice: { currencyCode: "USD", value: "1.00" } } }],
        paymentPreferences: { autoBillOutstanding: false, paymentFailureThreshold: 3 },
      },
    });
    state.planId = plan.id;
  }
  save();
  for (const key of ["healthy", "failing"]) {
    if (state[key]) continue;
    const sub = await c.subscriptions.createSubscription({
      prefer: "return=representation",
      payPalRequestId: `lifeline-failtest-sub-${key}`,
      body: { planId: state.planId, customId: `failtest-${key}`, applicationContext: { brandName: "Lifeline test", returnUrl: "https://example.com/approved", cancelUrl: "https://example.com/cancelled" } },
    });
    state[key] = { id: sub.id, approve: sub.links?.find((l) => l.rel === "approve")?.href };
    save();
  }
  console.log(JSON.stringify({ plan: state.planId, healthy: state.healthy, failing: state.failing }, null, 1));
} else {
  for (const key of ["healthy", "failing"]) {
    const s = await c.subscriptions.getSubscription({ id: state[key].id });
    const b = s.billingInfo;
    console.log(key, s.status, JSON.stringify({ failed: b?.failedPaymentsCount, outstanding: b?.outstandingBalance?.value, last: b?.lastPayment?.time, lastFailed: b?.lastFailedPayment, next: b?.nextBillingTime }));
  }
}
