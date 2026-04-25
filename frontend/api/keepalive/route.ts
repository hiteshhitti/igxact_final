import { NextResponse } from "next/server";

// Vercel cron calls this route on schedule (see vercel.json)
// It pings the Render backend /health to prevent it from sleeping.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const backendUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!backendUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_API_URL not set" }, { status: 500 });
  }

  try {
    const start = Date.now();
    const res = await fetch(`${backendUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(15000), // 15s timeout
    });
    const ms = Date.now() - start;
    return NextResponse.json({ ok: res.ok, ms });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
