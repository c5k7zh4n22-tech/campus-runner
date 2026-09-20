import { NextResponse } from "next/server";
import { getRuntimeCapabilities } from "@/lib/services/runtime-config";
import { isDatabaseConfigured, query } from "@/lib/db";

async function checkDatabase() {
  if (!isDatabaseConfigured()) return { ok: false, status: "unconfigured" as const };

  try {
    await query("select 1");
    return { ok: true, status: "ok" as const };
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : undefined;
    return { ok: false, status: "error" as const, code };
  }
}

export async function GET() {
  const database = await checkDatabase();

  return NextResponse.json({
    ok: database.ok,
    service: "campus-runner",
    version: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
    time: new Date().toISOString(),
    checks: { database },
    capabilities: getRuntimeCapabilities()
  }, { status: database.ok ? 200 : 503 });
}
