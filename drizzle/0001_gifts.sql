CREATE TABLE "gifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"donor_id" uuid NOT NULL,
	"paypal_transaction_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"recovered_failure_id" uuid,
	"charged_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gifts_paypal_transaction_id_unique" UNIQUE("paypal_transaction_id")
);
--> statement-breakpoint
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gifts_org_idx" ON "gifts" USING btree ("org_id","charged_at");--> statement-breakpoint
CREATE INDEX "gifts_donor_idx" ON "gifts" USING btree ("donor_id","charged_at");