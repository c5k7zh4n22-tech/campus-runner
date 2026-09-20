import pg from "pg";

const email = process.argv[2];
const databaseUrl = process.env.DATABASE_URL;

if (!email) {
  console.error("Usage: node scripts/promote-admin-postgres.mjs user@example.com");
  process.exit(1);
}

if (!databaseUrl) {
  console.error("Set DATABASE_URL first.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
});

await client.connect();
try {
  const result = await client.query(
    `update profiles p
     set role = 'admin', status = 'active', updated_at = now()
     from app_users u
     where u.id = p.id and lower(u.email) = lower($1)
     returning p.id, u.email`,
    [email]
  );
  if (result.rowCount === 0) {
    console.error(`User not found: ${email}`);
    process.exitCode = 1;
  } else {
    console.log(`Promoted ${result.rows[0].email} (${result.rows[0].id}) to admin.`);
  }
} finally {
  await client.end();
}
