import { NextResponse } from "next/server";
import { getRuntimeCapabilities } from "@/lib/services/runtime-config";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "campus-runner",
    version: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
    time: new Date().toISOString(),
    capabilities: getRuntimeCapabilities()
  });
}
