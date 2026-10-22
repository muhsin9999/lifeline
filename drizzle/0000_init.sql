CREATE TABLE "audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"kind" text NOT NULL,
	"subject_type" text,
	"subject_id" uuid,
	"model" text,
	"input_hash" text,
	"output" jsonb,
	"approved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"plan_id" uuid,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"paypal_subscription_id" text,
	"status" text DEFAULT 'APPROVAL_PENDING' NOT NULL,
	"failed_payments_count" integer DEFAULT 0 NOT NULL,
	"outstanding_cents" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"last_payment_at" timestamp with time zone,
	"next_billing_at" timestamp with time zone,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "donors_key_unique" UNIQUE("key"),
	CONSTRAINT "donors_paypal_subscription_id_unique" UNIQUE("paypal_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"donor_id" uuid,
	"source" text DEFAULT 'paypal' NOT NULL,
	"paypal_event_id" text,
	"type" text NOT NULL,
	"summary" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"simulated" boolean DEFAULT false NOT NULL,
	"payload" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"donor_id" uuid NOT NULL,
	"paypal_event_id" text,
	"status" text DEFAULT 'new' NOT NULL,
	"amount_cents" integer NOT NULL,
	"reason_code" text,
	"failed_at" timestamp with time zone NOT NULL,
	"next_retry_at" timestamp with time zone,
	"diagnosis" jsonb,
	"fixes" jsonb,
	"recommended_fix" text,
	"chosen_fix" text,
	"trace" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text,
	"error" text,
	"recovered_cents" integer,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"failure_id" uuid NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"provider_id" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orgs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "paypal_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_key" text NOT NULL,
	"org_id" uuid,
	"failure_id" uuid,
	"kind" text NOT NULL,
	"status" text DEFAULT 'claimed' NOT NULL,
	"result" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"interval_unit" text DEFAULT 'MONTH' NOT NULL,
	"paypal_product_id" text,
	"paypal_plan_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_slug_unique" UNIQUE("slug"),
	CONSTRAINT "plans_paypal_plan_id_unique" UNIQUE("paypal_plan_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paypal_event_id" text,
	"type" text,
	"verification" text NOT NULL,
	"outcome" text NOT NULL,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit" ADD CONSTRAINT "audit_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donors" ADD CONSTRAINT "donors_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donors" ADD CONSTRAINT "donors_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failures" ADD CONSTRAINT "failures_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failures" ADD CONSTRAINT "failures_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_failure_id_failures_id_fk" FOREIGN KEY ("failure_id") REFERENCES "public"."failures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paypal_actions" ADD CONSTRAINT "paypal_actions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paypal_actions" ADD CONSTRAINT "paypal_actions_failure_id_failures_id_fk" FOREIGN KEY ("failure_id") REFERENCES "public"."failures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_org_idx" ON "audit" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "donors_org_idx" ON "donors" USING btree ("org_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "events_paypal_event_idx" ON "events" USING btree ("paypal_event_id");--> statement-breakpoint
CREATE INDEX "events_org_idx" ON "events" USING btree ("org_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "failures_paypal_event_idx" ON "failures" USING btree ("paypal_event_id");--> statement-breakpoint
CREATE INDEX "failures_org_idx" ON "failures" USING btree ("org_id","status","failed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "paypal_actions_claim_key_idx" ON "paypal_actions" USING btree ("claim_key");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_received_idx" ON "webhook_deliveries" USING btree ("received_at");