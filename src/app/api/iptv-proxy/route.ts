import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const channelId = request.nextUrl.searchParams.get("id");
  if (!channelId) {
    return NextResponse.json({ error: "Missing channel ID" }, { status: 400 });
  }

  try {
    // Step 1: Get the CDN URL from seatv.xyz
    const redirectRes = await fetch(`http://seatv.xyz/B2X4MX4S65WNTPY/bc65CNzbec/${channelId}`, {
      headers: {
        "User-Agent": "Lavf53.32.100",
        "Icy-MetaData": "1",
        "Accept-Encoding": "identity",
        "Connection": "Keep-Alive",
      },
      redirect: "manual",
    });

    const location = redirectRes.headers.get("Location");
    if (!location) {
      return NextResponse.json({ error: "No redirect from server" }, { status: 502 });
    }

    // Step 2: Fetch the CDN stream and pipe it directly
    const cdnRes = await fetch(location, {
      headers: {
        "User-Agent": "Lavf53.32.100",
        "Icy-MetaData": "1",
        "Accept-Encoding": "identity",
        "Connection": "Keep-Alive",
        "Host": new URL(location).host,
      },
    });

    if (!cdnRes.ok) {
      return NextResponse.json({ error: `CDN returned ${cdnRes.status}` }, { status: 502 });
    }

    // Pipe the video directly to the browser
    return new NextResponse(cdnRes.body, {
      status: 200,
      headers: {
        "Content-Type": cdnRes.headers.get("Content-Type") || "video/mp2t",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}