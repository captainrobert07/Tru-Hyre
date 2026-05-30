import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    name: process.env.NEXT_PUBLIC_APP_NAME || "Tru Hyre",
    phase: 1,
    timestamp: new Date().toISOString(),
  });
}
