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

function unauthorized() {
  return NextResponse.json({ ok: false }, { status: 404 });
}

export async function POST(request: NextRequest) {
  const token = process.env.MIGRATION_TOKEN;
  if (!token || request.headers.get("x-migration-token") !== token) return unauthorized();

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
