import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email) {
  console.error("Usage: npm run admin:promote -- user@example.com");
  process.exit(1);
}
if (!url || !serviceRoleKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (error) throw error;
const user = data.users.find((item) => item.email?.toLowerCase() === email);

if (!user) {
  console.error("User not found. Register in the app first, then run this command.");
  process.exit(1);
}

const { error: updateError } = await admin.from("profiles").update({ role: "admin" }).eq("id", user.id);
if (updateError) throw updateError;
console.log(`Promoted ${email} to administrator.`);
