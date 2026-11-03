import { NextResponse, type NextRequest } from "next/server";

// Names must match src/server/workspace.ts (which can't be imported here: it is server-only).
const VISITOR_COOKIE = "ll_visitor";
const LIVE_COOKIE = "ll_live";
const MONTH = 60 * 60 * 24 * 30;

/**
 * Gives each visitor an id, so everyone works in their own practice copy of the food bank. The id is added to the
 * request too, so the very first render already sees it. ?live=<LIVE_WORKSPACE_KEY> opens the real workspace
 * (for the owner and the demo video); ?live=off goes back to the practice copy.
 */
export function proxy(req: NextRequest) {
  const cookies: [string, string, number][] = [];
  const live = req.nextUrl.searchParams.get("live");
  if (live && process.env.LIVE_WORKSPACE_KEY) cookies.push([LIVE_COOKIE, live === process.env.LIVE_WORKSPACE_KEY ? live : "", live === process.env.LIVE_WORKSPACE_KEY ? MONTH : 0]);
  if (!req.cookies.get(VISITOR_COOKIE)?.value) cookies.push([VISITOR_COOKIE, crypto.randomUUID(), MONTH]);
  if (!cookies.length) return NextResponse.next();

  const jar = new Map(req.cookies.getAll().map((c) => [c.name, c.value]));
  for (const [name, value] of cookies) jar.set(name, value);
  const headers = new Headers(req.headers);
  headers.set("cookie", [...jar].filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join("; "));
  const res = NextResponse.next({ request: { headers } });
  for (const [name, value, maxAge] of cookies) res.cookies.set(name, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge });
  return res;
}

export const config = { matcher: ["/rescues/:path*", "/donors/:path*", "/reports/:path*", "/dashboard/:path*", "/activity/:path*", "/api/ask/:path*", "/api/memos/:path*", "/api/studio-llm/:path*"] };
