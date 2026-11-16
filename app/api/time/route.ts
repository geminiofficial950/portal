import { connection } from "next/server";

// The server's clock, for the portal header clock: it keeps the college time even when a laptop's own clock is wrong.
export async function GET() {
  await connection(); // always the time of this request, never a cached one
  return Response.json({ now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
