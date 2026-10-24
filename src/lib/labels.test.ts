import { describe, expect, it } from "vitest";
import { plainWords } from "./labels";

// The inputs are the two real diagnoses the live agent wrote for Cora's failed gifts (23 and 24 Oct).
describe("plainWords", () => {
  it("turns PayPal's reason code into a reason", () => {
    expect(plainWords("Cora Reed’s $1 monthly gift failed on Oct 23 with PayPal reason code PAYER_CANNOT_PAY. Her subscription is still ACTIVE, and PayPal shows $1 outstanding with no retry time listed.")).toBe(
      "Cora Reed’s $1 monthly gift failed on Oct 23 because the payment was declined. Her subscription is still active, and PayPal shows $1 outstanding with no retry time listed.",
    );
  });

  it("cleans a code on its own and leaves ordinary capitals alone", () => {
    expect(plainWords("PayPal shows 2 failed payments (PAYER_CANNOT_PAY) and $2.00 outstanding; the subscription is still active. OK, US dollars.")).toBe("PayPal shows 2 failed payments (payment declined) and $2.00 outstanding; the subscription is still active. OK, US dollars.");
  });

  it("leaves plain text unchanged", () => {
    const text = "Ava's gift went through on Oct 24.";
    expect(plainWords(text)).toBe(text);
  });
});
