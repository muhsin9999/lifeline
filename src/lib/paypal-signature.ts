// PayPal's offline webhook check: the signature covers "transmissionId|time|webhookId|crc32(raw body)", signed
// with SHA256withRSA by the certificate at paypal-cert-url. It runs on the exact bytes PayPal sent, so nothing is
// lost to re-serialising the JSON (which is what breaks the online verify-webhook-signature call).
import { createVerify } from "node:crypto";
import { crc32 } from "node:zlib";

export function signedMessage(transmissionId: string, time: string, webhookId: string, raw: string) {
  return `${transmissionId}|${time}|${webhookId}|${crc32(Buffer.from(raw, "utf8")) >>> 0}`;
}

export function checkSignature(input: { transmissionId: string; time: string; webhookId: string; raw: string; signature: string; certPem: string }) {
  const v = createVerify("sha256");
  v.update(signedMessage(input.transmissionId, input.time, input.webhookId, input.raw));
  return v.verify(input.certPem, input.signature, "base64");
}

/** Only PayPal's own hosts may serve the signing certificate. */
export function trustedCertUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "api.paypal.com" || u.hostname === "api.sandbox.paypal.com" || u.hostname === "api-m.paypal.com" || u.hostname === "api-m.sandbox.paypal.com");
  } catch {
    return false;
  }
}
