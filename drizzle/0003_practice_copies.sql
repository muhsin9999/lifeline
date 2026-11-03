ALTER TABLE "donors" DROP CONSTRAINT "donors_key_unique";--> statement-breakpoint
ALTER TABLE "donors" DROP CONSTRAINT "donors_paypal_subscription_id_unique";--> statement-breakpoint
ALTER TABLE "gifts" DROP CONSTRAINT "gifts_paypal_transaction_id_unique";--> statement-breakpoint
DROP INDEX "events_paypal_event_idx";--> statement-breakpoint
DROP INDEX "failures_paypal_event_idx";--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "copy_of" uuid;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "visitor_key" text;--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_copy_of_orgs_id_fk" FOREIGN KEY ("copy_of") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "donors_org_key_idx" ON "donors" USING btree ("org_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "donors_org_subscription_idx" ON "donors" USING btree ("org_id","paypal_subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gifts_org_transaction_idx" ON "gifts" USING btree ("org_id","paypal_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_paypal_event_idx" ON "events" USING btree ("org_id","paypal_event_id") NULLS NOT DISTINCT;--> statement-breakpoint
CREATE UNIQUE INDEX "failures_paypal_event_idx" ON "failures" USING btree ("org_id","paypal_event_id");--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_visitor_key_unique" UNIQUE("visitor_key");