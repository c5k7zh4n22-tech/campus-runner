import "server-only";

import { Pool, type PoolClient, type QueryResultRow } from "pg";

const databaseUrl = process.env.DATABASE_URL || "";

declare global {
  var __campusRunnerPgPool: Pool | undefined;
}

export function isDatabaseConfigured() {
  return Boolean(databaseUrl);
}

export function getPool() {
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  globalThis.__campusRunnerPgPool ??= new Pool({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.DATABASE_POOL_MAX || 10)
  });
  return globalThis.__campusRunnerPgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  return getPool().query<T>(text, values);
}

export async function maybeOne<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  const result = await query<T>(text, values);
  return result.rows[0] ?? null;
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export function dbErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "数据库操作失败";
}
