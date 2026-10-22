import { createSign, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkSignature, signedMessage, trustedCertUrl } from "./paypal-signature";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
const raw = '{"id":"WH-1","event_type":"CUSTOMER.DISPUTE.CREATED","resource":{"amount":"250.00","note":"caf\\u00e9 \\/ ok"}}';
const sign = (body: string) => createSign("sha256").update(signedMessage("t-1", "2026-10-22T10:00:00Z", "WH-ID", body)).sign(privateKey, "base64");

describe("PayPal webhook signature", () => {
  it("accepts the exact body PayPal signed", () => {
    expect(checkSignature({ transmissionId: "t-1", time: "2026-10-22T10:00:00Z", webhookId: "WH-ID", raw, signature: sign(raw), certPem: pem })).toBe(true);
  });
  it("rejects a re-serialised or altered body", () => {
    const reserialised = JSON.stringify(JSON.parse(raw));
    expect(reserialised).not.toBe(raw);
    expect(checkSignature({ transmissionId: "t-1", time: "2026-10-22T10:00:00Z", webhookId: "WH-ID", raw: reserialised, signature: sign(raw), certPem: pem })).toBe(false);
  });
  it("rejects a signature made for another webhook", () => {
    expect(checkSignature({ transmissionId: "t-1", time: "2026-10-22T10:00:00Z", webhookId: "OTHER", raw, signature: sign(raw), certPem: pem })).toBe(false);
  });
  it("trusts certificates only from PayPal's API hosts", () => {
    expect(trustedCertUrl("https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1")).toBe(true);
    expect(trustedCertUrl("https://api.sandbox.paypal.com.evil.example/cert")).toBe(false);
    expect(trustedCertUrl("http://api.paypal.com/cert")).toBe(false);
  });
});
