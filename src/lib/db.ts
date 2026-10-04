import "server-only";

import { Pool, type PoolClient, type QueryResultRow } from "pg";

const databaseUrl = process.env.DATABASE_URL || "";
const sslModesRequiringTls = new Set(["prefer", "require", "verify-ca", "verify-full"]);

declare global {
  var __campusRunnerPgPool: Pool | undefined;
}

export function isDatabaseConfigured() {
  return Boolean(databaseUrl);
}

function databasePoolMax() {
  const configured = Number(process.env.DATABASE_POOL_MAX);
  if (Number.isInteger(configured) && configured > 0) return configured;
  return process.env.VERCEL ? 3 : 10;
}

function databaseConnectionConfig() {
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");

  try {
    const url = new URL(databaseUrl);
    const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
    const requiresTls = Boolean(sslMode && sslModesRequiringTls.has(sslMode));
    const explicitSsl = process.env.DATABASE_SSL === "true";

    if (requiresTls) {
      url.searchParams.delete("sslmode");
      return {
        connectionString: url.toString(),
        ssl: { rejectUnauthorized: sslMode === "verify-full" }
      };
    }

    return {
      connectionString: databaseUrl,
      ssl: explicitSsl ? { rejectUnauthorized: false } : undefined
    };
  } catch {
    return {
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
    };
  }
}

export function getPool() {
  globalThis.__campusRunnerPgPool ??= new Pool({
    ...databaseConnectionConfig(),
    max: databasePoolMax(),
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
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
