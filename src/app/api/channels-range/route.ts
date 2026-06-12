import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const start = request.nextUrl.searchParams.get("start") || "73";
  const end = request.nextUrl.searchParams.get("end") || "144";

  try {
    const res = await fetch(
      `https://hls.bravestream.live/api/channels/range?start=${start}&end=${end}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message, channels: [] }, { status: 502 });
  }
}