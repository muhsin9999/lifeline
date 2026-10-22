// Health check. Deliberately does not touch the database, so Neon's free compute can scale to zero.
export async function GET() {
  return Response.json({ ok: true });
}
