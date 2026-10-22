// Lifeline's tables. PayPal holds the money; these rows hold what Lifeline knows about each donor and each rescue.
import { relations, sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// The nonprofit using Lifeline (the fictional food bank in the sandbox).
export const orgs = pgTable("orgs", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("USD"),
  createdAt: createdAt(),
});

// A monthly-giving tier, backed by a PayPal catalog product + billing plan.
export const plans = pgTable("plans", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  amountCents: integer("amount_cents").notNull(),
  intervalUnit: text("interval_unit").notNull().default("MONTH"),
  paypalProductId: text("paypal_product_id"),
  paypalPlanId: text("paypal_plan_id").unique(),
  createdAt: createdAt(),
});

// A recurring donor: one PayPal subscription. Status mirrors PayPal (APPROVAL_PENDING, ACTIVE, SUSPENDED, CANCELLED…).
export const donors = pgTable(
  "donors",
  {
    id: id(),
    orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").references(() => plans.id, { onDelete: "set null" }),
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    amountCents: integer("amount_cents").notNull(),
    paypalSubscriptionId: text("paypal_subscription_id").unique(),
    status: text("status").notNull().default("APPROVAL_PENDING"),
    failedPaymentsCount: integer("failed_payments_count").notNull().default(0),
    outstandingCents: integer("outstanding_cents").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    lastPaymentAt: timestamp("last_payment_at", { withTimezone: true }),
    nextBillingAt: timestamp("next_billing_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("donors_org_idx").on(t.orgId, t.status)],
);

// Every monthly gift PayPal charged (PAYMENT.SALE.COMPLETED, or read back from the subscription's transactions).
// These are the beats of the giving pulse.
export const gifts = pgTable(
  "gifts",
  {
    id: id(),
    orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    donorId: uuid("donor_id").notNull().references(() => donors.id, { onDelete: "cascade" }),
    paypalTransactionId: text("paypal_transaction_id").notNull().unique(),
    amountCents: integer("amount_cents").notNull(),
    // Set when this gift was the one that recovered a failure.
    recoveredFailureId: uuid("recovered_failure_id"),
    chargedAt: timestamp("charged_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("gifts_org_idx").on(t.orgId, t.chargedAt), index("gifts_donor_idx").on(t.donorId, t.chargedAt)],
);

// One failed gift and its rescue: the agent's diagnosis, the fixes it offers, the officer's choice and the outcome.
export const failures = pgTable(
  "failures",
  {
    id: id(),
    orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    donorId: uuid("donor_id").notNull().references(() => donors.id, { onDelete: "cascade" }),
    paypalEventId: text("paypal_event_id"),
    // new → diagnosing → awaiting_approval → acting → recovered | paused | cancelled | lost
    status: text("status").notNull().default("new"),
    amountCents: integer("amount_cents").notNull(),
    reasonCode: text("reason_code"),
    failedAt: timestamp("failed_at", { withTimezone: true }).notNull(),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    diagnosis: jsonb("diagnosis").$type<{ cause: string; summary: string; confidence: "high" | "medium" | "low" }>(),
    fixes: jsonb("fixes").$type<string[]>(),
    recommendedFix: text("recommended_fix"),
    chosenFix: text("chosen_fix"),
    trace: jsonb("trace").$type<{ tool: string; label: string; at: string; turn?: number; detail?: string; plan?: string[] }[]>().notNull().default(sql`'[]'::jsonb`),
    model: text("model"),
    error: text("error"),
    recoveredCents: integer("recovered_cents"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("failures_paypal_event_idx").on(t.paypalEventId), index("failures_org_idx").on(t.orgId, t.status, t.failedAt)],
);

// The personal note to the donor: drafted by the agent, approved by the officer, then sent.
export const notes = pgTable("notes", {
  id: id(),
  failureId: uuid("failure_id").notNull().references(() => failures.id, { onDelete: "cascade" }),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  // draft → approved → sent | failed
  status: text("status").notNull().default("draft"),
  providerId: text("provider_id"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// Durable-write claims (paypal-plan.md §1b.1): one row is claimed before each PayPal write, so a second click
// or a retry can't reach PayPal twice, and a lost answer leaves something to settle by re-reading.
export const paypalActions = pgTable(
  "paypal_actions",
  {
    id: id(),
    claimKey: text("claim_key").notNull(),
    orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }),
    failureId: uuid("failure_id").references(() => failures.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    // claimed → done | unknown (re-read pending); refused claims are deleted
    status: text("status").notNull().default("claimed"),
    result: jsonb("result"),
    error: text("error"),
    createdAt: createdAt(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("paypal_actions_claim_key_idx").on(t.claimKey)],
);

// Every PayPal event (and Lifeline's own milestones) in plain English, for the activity timeline.
export const events = pgTable(
  "events",
  {
    id: id(),
    orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }),
    donorId: uuid("donor_id").references(() => donors.id, { onDelete: "set null" }),
    source: text("source").notNull().default("paypal"),
    paypalEventId: text("paypal_event_id"),
    type: text("type").notNull(),
    summary: text("summary").notNull(),
    verified: boolean("verified").notNull().default(false),
    simulated: boolean("simulated").notNull().default(false),
    payload: jsonb("payload"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("events_paypal_event_idx").on(t.paypalEventId), index("events_org_idx").on(t.orgId, t.occurredAt)],
);

// Every webhook delivery, accepted or not, for the webhook health panel.
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: id(),
    paypalEventId: text("paypal_event_id"),
    type: text("type"),
    verification: text("verification").notNull(),
    outcome: text("outcome").notNull(),
    error: text("error"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhook_deliveries_received_idx").on(t.receivedAt)],
);

// Every AI decision and every approval, with the model and a hash of its input.
export const audit = pgTable(
  "audit",
  {
    id: id(),
    orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    subjectType: text("subject_type"),
    subjectId: uuid("subject_id"),
    model: text("model"),
    inputHash: text("input_hash"),
    output: jsonb("output"),
    approvedBy: text("approved_by"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_org_idx").on(t.orgId, t.createdAt)],
);

export const orgsRelations = relations(orgs, ({ many }) => ({ donors: many(donors), plans: many(plans), failures: many(failures) }));
export const plansRelations = relations(plans, ({ one, many }) => ({ org: one(orgs, { fields: [plans.orgId], references: [orgs.id] }), donors: many(donors) }));
export const donorsRelations = relations(donors, ({ one, many }) => ({
  org: one(orgs, { fields: [donors.orgId], references: [orgs.id] }),
  plan: one(plans, { fields: [donors.planId], references: [plans.id] }),
  failures: many(failures),
  gifts: many(gifts),
}));
export const giftsRelations = relations(gifts, ({ one }) => ({ donor: one(donors, { fields: [gifts.donorId], references: [donors.id] }) }));
export const failuresRelations = relations(failures, ({ one, many }) => ({
  org: one(orgs, { fields: [failures.orgId], references: [orgs.id] }),
  donor: one(donors, { fields: [failures.donorId], references: [donors.id] }),
  notes: many(notes),
}));
export const notesRelations = relations(notes, ({ one }) => ({ failure: one(failures, { fields: [notes.failureId], references: [failures.id] }) }));
