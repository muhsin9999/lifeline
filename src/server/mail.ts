// Sends the officer-approved note. The sandbox donors' addresses are PayPal test accounts that can't receive
// mail, so every note goes to the demo's test inbox (NOTE_INBOX) and says who it was written for.
import "server-only";

export type SendResult = { ok: true; id: string; to: string } | { ok: false; status: number; message: string };

export async function sendNote(n: { donorName: string; donorEmail: string; subject: string; body: string }): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const inbox = process.env.NOTE_INBOX;
  if (!key || !inbox) return { ok: false, status: 503, message: "Email isn't set up yet (RESEND_API_KEY and NOTE_INBOX)." };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.NOTE_FROM || "Lifeline <onboarding@resend.dev>",
      to: [inbox],
      subject: n.subject,
      text: `${n.body}\n\n—\nSent by Lifeline from the PayPal sandbox demo. Written for ${n.donorName} (${n.donorEmail}); delivered to the demo test inbox.`,
    }),
    cache: "no-store",
  }).catch(() => null);
  if (!res) return { ok: false, status: 502, message: "Couldn't reach the email service." };
  const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !json.id) return { ok: false, status: res.status >= 500 ? 502 : res.status, message: json.message ?? "The email service refused the note." };
  return { ok: true, id: json.id, to: inbox };
}
