import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("select pg_advisory_lock(20260929)");
  await client.query("create table if not exists app_migrations (name text primary key, applied_at timestamptz not null default now())");
  const files = (await readdir("migrations")).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
  for (const name of files) {
    if ((await client.query("select 1 from app_migrations where name = $1", [name])).rowCount) continue;
    await client.query("begin");
    try {
      await client.query(await readFile(path.join("migrations", name), "utf8"));
      await client.query("insert into app_migrations(name) values ($1)", [name]);
      await client.query("commit");
      console.log(`Applied ${name}`);
    } catch (error) { await client.query("rollback"); throw error; }
  }
} finally {
  await client.query("select pg_advisory_unlock(20260929)");
  client.release(); await pool.end();
}
