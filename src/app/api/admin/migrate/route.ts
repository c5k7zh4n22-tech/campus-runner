import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";

const requiredTables = [
  "app_users",
  "profiles",
  "orders",
  "marketplace_listings",
  "marketplace_interests"
];

function unauthorized(token: string | undefined, headerValue: string | null) {
  return NextResponse.json({
    ok: false,
    hasToken: Boolean(token),
    headerLength: headerValue?.length ?? 0,
    tokenLength: token?.length ?? 0
  }, { status: 404 });
}

export async function POST(request: NextRequest) {
  const token = process.env.MIGRATION_TOKEN;
  const headerValue = request.headers.get("x-migration-token");
  if (!token || headerValue !== token) return unauthorized(token, headerValue);

  const migration = await readFile(join(process.cwd(), "migrations", "0001_postgres_app.sql"), "utf8");
  await query(migration);

  const result = await query<{ table_name: string }>(
    `select table_name
     from information_schema.tables
     where table_schema = 'public'
       and table_name = any($1::text[])
     order by table_name`,
    [requiredTables]
  );

  return NextResponse.json({
    ok: true,
    tables: result.rows.map((row) => row.table_name)
  });
}
