import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "campus-runner",
    time: new Date().toISOString(),
    databaseConfigured: isSupabaseConfigured
  });
}
