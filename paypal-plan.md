# PayPal plan and contract sheet (Lifeline)

Lifeline rescues failed recurring donations for a small food bank. This sheet records every PayPal call it makes and the rules each call follows. Every fact comes from the APIMatic PayPal TypeScript SDK `paypal` v2.29.0: `node_modules/paypal/sdk-map.md`, `map/operations/subscriptions.md`, `map/operations/transaction-search.md`, the model files in `src/models/`, and `api-reference.md`.

## Survey

| Item | Fact |
| --- | --- |
| Module format | ESM (`"type": "module"`). Only `import` is used, so one copy of the SDK loads and `instanceof` on its error classes works. |
| Runtime | Node 22, in Next.js 16 route handlers and server actions, and in `tsx` scripts. Hosted on Vercel (Node runtime, not Edge). |
| Package manager | npm. `paypal` comes from `github:context-plugins/paypal-typescript-sdk#v2.29.0` and is installed and built (`dist/esm`, `dist/commonjs`). |
| tsconfig | `strict: true`. `exactOptionalPropertyTypes` and `verbatimModuleSyntax` are off, but optional fields are still left out rather than set to `undefined`. |
| Checks | `npm run typecheck` (`tsc --noEmit`), `npm test` (vitest), `npm run lint`. |
| Exemplar files | PayPal REST client and webhook check: `~/projects/cleared/src/server/paypal/client.ts` and `webhooks.ts`. SDK use with claims and re-reads: `~/projects/cleared/src/server/paypal/tracking.ts`. |

## Host and client

- **Host:** the PayPal sandbox only. The SDK's single default base URL is `https://api-m.sandbox.paypal.com`, and `serverOptions` is not overridden. At startup, `src/server/paypal/sdk.ts` refuses any `PAYPAL_ENV` other than unset or `sandbox`, so a live secret can never reach the sandbox host or the other way round.
- **Client:** one `PaypalClient`, built lazily, held for the whole process, and never rebuilt per request. Options:
  - `oauth2: { clientId, clientSecret }` from `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`. Both are required; it fails fast if either is missing.
  - `logging: { level: "off" }`, set explicitly so the `PAYPAL_CLIENT_LOG` variable can't turn logging on. Request bodies carry donor names and emails, so `logRequestBody` stays off and no call passes its own log level.
  - `retry`: the defaults. GETs are retried; POST and PATCH are not, because `httpMethodsToRetry` doesn't list them.
- **Pagination and streaming:** the SDK does neither. Lifeline lists at most one page of 20 per call (`listSubscriptions` and `searchTransactions`, both with `pageSize`) and needs no auto-paging.
- **`Error` model alias:** if one is ever needed, import it as `import type { Error as SdkError } from "paypal"`. The error base is used as `PaypalError`.
- **Calls outside the SDK, made with the plain REST client in `src/server/paypal/rest.ts`:**
  - Catalog products (`POST /v1/catalogs/products`), used only by the seed script. The SDK has no catalog resource.
  - `POST /v1/notifications/verify-webhook-signature` and webhook registration. The SDK has no notifications resource.

## Assumptions and blockers

1. **Status is missing from the SDK's types (major, settled).** The SDK's `Subscription` model has no `status` field, so `getSubscription` doesn't type it. Objects are decoded with `zod.looseObject` (`src/core/validation/schema.ts:132`), so an extra field like `status` still survives at run time. Lifeline reads it with a runtime check: `typeof (sub as { status?: unknown }).status === "string"`. If it's absent, the status counts as **unknown**, never guessed. The read-only smoke test confirms PayPal returns it.
2. **Lowering the amount (minor).** `api-reference.md` says `patchSubscription` can replace `plan.billing_cycles[@sequence==1].pricing_scheme.fixed_price` without the donor's approval. For PayPal-funded subscriptions the new price only applies to billing cycles more than 10 days away, and the UI must say so. `reviseSubscription` needs the buyer's approval, so Lifeline doesn't use it.
3. **Moving the billing date isn't possible (minor).** `start_time` can only be patched before the subscription starts, so "switch the date" is out of the fix set. The fixes are:
   - retry now (`captureSubscription`)
   - pause (`suspendSubscription`)
   - resume (`activateSubscription`)
   - lower the amount (`patchSubscription`, fixed_price)
   - forgive the missed gift (`patchSubscription`, `billing_info.outstanding_balance` set to 0)
   - cancel (`cancelSubscription`)
4. **Real failed payments (open, not a code blocker).** No PayPal document explains how to make a sandbox renewal fail. It will be tested with a daily plan and a donor whose funding is removed after the first payment. If that fails, simulated webhook events are labelled as simulated in the app.

## Operations in scope

Every operation:
- uses `oauth2` auth on the `default` server;
- takes a flat request object, with `body` as the whole JSON body;
- rejects with its own subclass on `Subscriptions.*` or `TransactionSearch.*`.

| Operation | Request type | Wire | Returns | Mode |
| --- | --- | --- | --- | --- |
| `createBillingPlan` | `Subscriptions.CreateBillingPlanRequest` | `POST /v1/billing/plans` | `BillingPlan` | await (seed) |
| `listBillingPlans` | `Subscriptions.ListBillingPlansRequest` | `GET /v1/billing/plans` | `PlanCollection` | await (seed re-read) |
| `createSubscription` | `Subscriptions.CreateSubscriptionRequestParams` | `POST /v1/billing/subscriptions` | `Subscription` | await (seed) |
| `listSubscriptions` | `Subscriptions.ListSubscriptionsRequest` | `GET /v1/billing/subscriptions` | `SubscriptionCollection` | await (seed re-read, sync) |
| `getSubscription` | `Subscriptions.GetSubscriptionRequest` | `GET /v1/billing/subscriptions/{id}` | `Subscription` | await |
| `listSubscriptionTransactions` | `Subscriptions.ListSubscriptionTransactionsRequest` | `GET /v1/billing/subscriptions/{id}/transactions` | `TransactionsList` | await |
| `captureSubscription` | `Subscriptions.CaptureSubscriptionRequestParams` | `POST /v1/billing/subscriptions/{id}/capture` | `SubscriptionTransactionDetails` | await |
| `suspendSubscription` | `Subscriptions.SuspendSubscriptionRequest` | `POST /v1/billing/subscriptions/{id}/suspend` | `undefined` | `.asApiResult()` |
| `activateSubscription` | `Subscriptions.ActivateSubscriptionRequestParams` | `POST /v1/billing/subscriptions/{id}/activate` | `undefined` | `.asApiResult()` |
| `cancelSubscription` | `Subscriptions.CancelSubscriptionRequestParams` | `POST /v1/billing/subscriptions/{id}/cancel` | `undefined` | `.asApiResult()` |
| `patchSubscription` | `Subscriptions.PatchSubscriptionRequest` | `PATCH /v1/billing/subscriptions/{id}` | `undefined` | `.asApiResult()` |
| `searchTransactions` | `TransactionSearch.SearchTransactionsRequest` | `GET /v1/reporting/transactions` | `SearchResponse` | await |

Five operations return `undefined`: suspend, activate, cancel, patch and createBillingPlan's siblings (not used). Each used one is called in `.asApiResult()` mode, chosen when the code is written, so its success status can be seen.

### Request fields (channel, wire name, required, default)

- **createBillingPlan**
  - `prefer`: header `Prefer`, defaults to `"return=minimal"`. **The SDK sends this default** unless it's set. We set `"return=representation"` because the seed needs the plan's `id` and `status`.
  - `payPalRequestId`: header `PayPal-Request-Id`, optional.
  - `body`: `PlanRequest`.
    - Required: `productId`, `name`, `billingCycles`, `paymentPreferences`.
    - Optional: `status`, `description`, `merchantPreferences`, `taxes`, `quantitySupported`.
- **createSubscription**
  - `prefer`: header `Prefer`, defaults to `"return=minimal"`. We send `"return=representation"`.
  - `payPalRequestId`: header `PayPal-Request-Id`, optional.
  - `payPalClientMetadataId`: header `PayPal-Client-Metadata-Id`, optional.
  - `body`: `CreateSubscriptionRequest`.
    - Required: `planId`.
    - Optional: `startTime`, `quantity`, `shippingAmount`, `subscriber`, `autoRenewal`, `applicationContext`, `customId`, `plan`.
  - `applicationContext` needs `returnUrl` and `cancelUrl`.
- **listBillingPlans**: `productId` (query `product_id`), `pageSize` (default 10), `page` (default 1), `totalRequired` (default false), `prefer` (default `"return=minimal"`).
- **listSubscriptions**: `planIds` (`plan_ids`), `statuses`, `pageSize` (default 10), `page` (default 1), and the other filters, which are unused.
- **getSubscription**: `id` (path), `fields` (query, optional).
- **listSubscriptionTransactions**: `id` (path), `startTime` (`start_time`, required), `endTime` (`end_time`, required).
- **captureSubscription**: `id` (path), `payPalRequestId` (header `PayPal-Request-Id`, optional), and `body: CaptureSubscriptionRequest`.
  - `note`: required, string.
  - `captureType`: required. The enum `CaptureType` has one member, `OutstandingBalance` = `"OUTSTANDING_BALANCE"`.
  - `amount`: required, `Money { currencyCode, value }`.
- **suspendSubscription**: `id` (path), `body: SuspendSubscription { reason: string }`. `reason` is required.
- **activateSubscription**: `id` (path), `body?: ActivateSubscriptionRequest { reason?: string }`.
- **cancelSubscription**: `id` (path), `body?: CancelSubscriptionRequest { reason: string }`. `reason` is required.
- **patchSubscription**: `id` (path), `body?: Patch[]`.
  - Each `Patch` is `{ op: PatchOp; path?: string; value?: Record<string, unknown>; from?: string }`.
  - `PatchOp` values: `"add"`, `"remove"`, `"replace"`, `"move"`, `"copy"`, `"test"`.
  - Because `value` must be an object, Lifeline sends:
    - `{ op: "replace", path: "/plan/billing_cycles/@sequence==1/pricing_scheme/fixed_price", value: { currency_code, value } }`
    - `{ op: "replace", path: "/billing_info/outstanding_balance", value: { currency_code, value: "0.00" } }`
  - `value` isn't schema-mapped, so its keys go to PayPal exactly as written, in snake_case.
- **searchTransactions**: `startDate` (`start_date`, required), `endDate` (`end_date`, required), `fields` (default `"transaction_info"`), `balanceAffectingRecordsOnly` (default `"Y"`), `pageSize` (default 100), `page` (default 1). **The SDK sends all of these defaults.** We pass `pageSize: 100` and leave the rest at their defaults.

### Response members Lifeline depends on (asserted right after each call)

All of these are optional unless marked required.

- `Subscription`
  - `id`
  - `billingInfo` (optional), which contains:
    - `outstandingBalance`: **required** inside `billingInfo`
    - `failedPaymentsCount`: **required** inside `billingInfo`
    - `lastFailedPayment?`, a `FailedPaymentDetails`:
      - `amount` (required)
      - `time` (required)
      - `reasonCode?`: `ReasonCode`, one of `PAYMENT_DENIED`, `INTERNAL_SERVER_ERROR`, `PAYEE_ACCOUNT_RESTRICTED`, `PAYER_ACCOUNT_RESTRICTED`, `PAYER_CANNOT_PAY`, `SENDING_LIMIT_EXCEEDED`, `TRANSACTION_RECEIVING_LIMIT_EXCEEDED`, `CURRENCY_MISMATCH`. The enum is open, so an unknown value is kept as it is.
      - `nextPaymentRetryTime?`
    - `nextBillingTime?`
    - `lastPayment?`
  - `links`, used to find the `approve` link
  - `status`: untyped, see assumption 1
- `BillingPlan.id`: must be present, or the outcome counts as unknown.
- `SubscriptionTransactionDetails`: the result of a capture. Lifeline records whatever it returns, then re-reads the subscription to confirm the outstanding balance.

### Error arms (per operation; read `err.status`, and never switch on an arm name across operations)

- **Subscriptions writes:**
  - `captureSubscription`, `suspendSubscription`, `activateSubscription`, `cancelSubscription` and `patchSubscription` have arms `subscriptionError` [400], `subscriptionError2` [401], `subscriptionError3` [403], `subscriptionError4` [404], `subscriptionError5` [422], `subscriptionError6` [500], `subscriptionError7` [default] and `undeclared`.
  - `createBillingPlan` and `createSubscription` have `subscriptionError` [400], `subscriptionError2` [401], `subscriptionError3` [403], `subscriptionError4` [422], `subscriptionError5` [500], `subscriptionError6` [default] and `undeclared`.
  - The body of every one of these is `SubscriptionError`: `name`, `message` and `debugId` are required; `details?` is an `ErrorDetails[]`.
- **getSubscription:** `subscriptionError` [401], `subscriptionError2` [403], `subscriptionError3` [404], `subscriptionError4` [500], `subscriptionError5` [default] and `undeclared`.
- **listSubscriptionTransactions:** [400], [401], [403], [404], [500], [default], in that order (`subscriptionError` to `subscriptionError6`), plus `undeclared`.
- **listSubscriptions:** [400], [401], [403], [500], [default], plus `undeclared`.
- **listBillingPlans:** [400], [401], [403], [404], [500], [default], plus `undeclared`.
- **searchTransactions:** `searchError` [default] and `undeclared`.

Every arm on the Subscriptions writes carries the same `SubscriptionError` model, so `src/server/paypal/errors.ts` reads `err.status` together with the body's `message`, `details[0].issue`, `details[0].description` and `debugId`. Doing that doesn't switch on arm names; it reads the shared model after narrowing to `ApiError` and checking `"body" in err.payload`.

## 1b.1 Durable writes

**Duplicate claims.** Before each PayPal call, a row is claimed in `paypal_actions`, which has a unique index on `claim_key`.

| Write | Where the claim is stored | What rejects the second one | Where that rejection is caught | Where in the code |
| --- | --- | --- | --- | --- |
| captureSubscription (retry now) | `paypal_actions`, `claim_key = capture:<failure_id>` | unique index `paypal_actions_claim_key_idx` | `catch` on Postgres code `23505` in `claimAction`, which then returns the winner's row | `src/server/paypal/actions.ts` `claimAction` + `runAction` |
| suspendSubscription (pause) | `claim_key = suspend:<failure_id>` | same index | same | same |
| activateSubscription (resume) | `claim_key = activate:<failure_id>` | same index | same | same |
| cancelSubscription | `claim_key = cancel:<failure_id>` | same index | same | same |
| patchSubscription (lower amount) | `claim_key = lower:<failure_id>` | same index | same | same |
| patchSubscription (forgive) | `claim_key = forgive:<failure_id>` | same index | same | same |
| createBillingPlan (seed) | `claim_key = plan:<plan_slug>` | same index | same | `scripts/seed.ts` via `claimAction` |
| createSubscription (seed) | `claim_key = subscribe:<donor_key>` | same index | same | `scripts/seed.ts` via `claimAction` |

- **Releasing a claim:** if PayPal refuses a call with a 4xx, the claim's status becomes `refused` and the row is deleted, so a later attempt isn't blocked. If the outcome is unknown, the row stays (status `unknown`) until a re-read settles it.
- **Idempotency keys:** where an operation has a `payPalRequestId` field (`captureSubscription`, `createBillingPlan`, `createSubscription`), it carries the claim row's id. PayPal can then join a resend to the first attempt. The SDK's own `Idempotency-Key` is minted per call and isn't relied on.

**Unknown outcomes.** A `connection` or `timeout` error, or a `DecodeError` on a 2xx, means the outcome is unknown. That write's `catch` re-reads PayPal before returning anything.

| Write | The operation you re-read with | The reference you search by | Where in the code | The test that fails the connection |
| --- | --- | --- | --- | --- |
| captureSubscription | `getSubscription` (`billingInfo.outstandingBalance.value === "0.00"` and `lastPayment.time` after the claim time) | subscription id plus the claim's `created_at` | TBD | TBD |
| suspendSubscription | `getSubscription` (status `SUSPENDED`) | subscription id | TBD | TBD |
| activateSubscription | `getSubscription` (status `ACTIVE`) | subscription id | TBD | TBD |
| cancelSubscription | `getSubscription` (status `CANCELLED`) | subscription id | TBD | TBD |
| patchSubscription (lower) | `getSubscription` (`plan.billingCycles[sequence 1]` price equals the new amount) | subscription id | TBD | TBD |
| patchSubscription (forgive) | `getSubscription` (`outstandingBalance.value === "0.00"`) | subscription id | TBD | TBD |
| createBillingPlan | `listBillingPlans({ productId })`, matching by `name` | product id plus plan name | TBD | TBD |
| createSubscription | `listSubscriptions({ planIds })`, matching by `customId` | `customId = <donor_key>` | TBD | TBD |

An `AuthError` or `EncodeError` means nothing was sent. The claim is released and **no re-read happens**. A separate test checks for each of those.

## 1b.2 Cross-operation invariants

| Invariant | Where the legal set comes from | Enforced where | The test that proves it |
| --- | --- | --- | --- |
| A rescue action only acts on a subscription Lifeline holds for that organisation | the `donors` table: `paypal_subscription_id` where `org_id` is the session's org. The client sends Lifeline's own `failure_id`, never a PayPal id. | `runAction` loads the failure and donor by the session org before claiming | TBD: an unknown or other-org `failure_id` is rejected, and the faked `fetch` is never called |
| An action must be one of the fixes offered for that failure | the `fixes` array stored on the failure row (the AI proposes fixes, code checks them against the fix set, the user approves) | `runAction`, before claiming | TBD: an action not in `fixes` is rejected, and `fetch` is never called |
| The new amount for "lower" is greater than 0 and less than the current amount | the donor's current plan amount in the `donors` table | `runAction`, before claiming | TBD |
| The seed's `createSubscription.planId` is a plan Lifeline created | the `plans` table | `scripts/seed.ts` | n/a (script) |

## 1b.3 Optional request fields

| Operation | Field | What requires it | Set it? |
| --- | --- | --- | --- |
| captureSubscription | `payPalRequestId` | the DUPLICATE CLAIMS row (claim id) | yes |
| captureSubscription | `body` | the task (retry now): `note`, `captureType: "OUTSTANDING_BALANCE"`, and `amount` = the outstanding balance read from PayPal | yes |
| suspendSubscription | `body` | `reason` is required by the model; the text comes from the approved fix ("Paused at the donor's request" or the user's own note) | yes |
| activateSubscription | `body` | nothing | no, leave it out |
| cancelSubscription | `body` | `reason` is required by the model; the text comes from the approved fix | yes |
| patchSubscription | `body` | the task (lower or forgive), using the two patch paths above | yes |
| createBillingPlan | `prefer` | the seed needs `id` and `status` back | yes, `"return=representation"` |
| createBillingPlan | `payPalRequestId` | the DUPLICATE CLAIMS row | yes |
| createBillingPlan | `body.status`, `description`, `merchantPreferences`, `taxes`, `quantitySupported` | nothing | no |
| createBillingPlan | `body.paymentPreferences.paymentFailureThreshold` | the failure test: a suspension must follow failures | yes, `3` |
| createBillingPlan | `body.paymentPreferences.autoBillOutstanding` | the task: "retry now" captures the outstanding balance by hand, so PayPal must not bill it automatically | yes, `false` |
| createBillingPlan | other `paymentPreferences` fields | nothing | no |
| createSubscription | `prefer` | the approve link is needed | yes, `"return=representation"` |
| createSubscription | `payPalRequestId` | the DUPLICATE CLAIMS row | yes |
| createSubscription | `customId` | the UNKNOWN OUTCOMES re-read (`customId` = donor key) | yes |
| createSubscription | `applicationContext` (`returnUrl`, `cancelUrl`, `brandName`) | the donor approves on PayPal and must come back; the brand name is the food bank's name | yes |
| createSubscription | `subscriber`, `startTime`, `quantity`, `shippingAmount`, `autoRenewal`, `plan`, `payPalClientMetadataId` | nothing | no |
| searchTransactions | `pageSize` | at most one page of 100 | leave it at the default (100) |

## 1b.4 When the API says no (Lifeline's server actions and route handlers)

**captureSubscription, suspendSubscription, activateSubscription, cancelSubscription and patchSubscription** use a subscription id from Lifeline's records and text the user approved.

| status | your app answers | the caller reads | test |
| --- | --- | --- | --- |
| a 4xx other than 401, 403 or 429 (e.g. 422 `SUBSCRIPTION_STATUS_INVALID`) | the same 4xx | PayPal's reason: `details[0].description`, `details[0].issue`, or `message`, from `err.payload.body` | fake a 422 with a reason and assert the reason appears in the response |
| 401 or 403 | 502 | "Lifeline couldn't sign in to PayPal" | fake a 401 and assert 502 and that message |
| 429 | 503 | "PayPal is busy, try again in a minute" | — |
| 5xx | 502 | "PayPal had a problem" | — |
| no response, on a write | per UNKNOWN OUTCOMES | "We're checking with PayPal", then the result of the re-read | — |
| no response, on a read | 502 | "Couldn't reach PayPal" | — |

The same table applies to the **reads** (`getSubscription`, `listSubscriptionTransactions`, `searchTransactions`), with no unknown-outcome row.

## Observability

- SDK logging is off (`level: "off"`).
- Lifeline logs its own lines in `catch` blocks, with `err.status`, the PayPal `debugId` from `err.payload.body`, and the claim key. It never logs a request body.
- There is no `fetch` wrapper; retries stay at the defaults.

## REQUIRED READING

- MUST load `typescript-error-handling`: the error boundary in `errors.ts`, narrowing on `kind`, and rethrowing anything outside the family. (Loaded.)
- MUST load `typescript-client-initialization`: before `new PaypalClient`.
- MUST load `typescript-calling-endpoints`: before the first call, for the flat request object, `.asApiResult()` on operations that return `undefined`, and defaults the SDK sends.
- MUST load `typescript-testing`: before the first test that fakes `fetch`.
