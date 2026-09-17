const baseUrl = process.argv[2];

if (!baseUrl) {
  console.error("Usage: node scripts/production-smoke.mjs https://your-domain.vercel.app");
  process.exit(1);
}

const checks = [
  ["home", "/", [200]],
  ["login", "/login", [200]],
  ["register", "/register", [200]],
  ["orders", "/orders", [200]],
  ["health", "/api/health", [200]],
  ["admin guard", "/admin", [200, 302, 307, 308]]
];

let failed = false;

for (const [name, path, expected] of checks) {
  try {
    const response = await fetch(new URL(path, baseUrl), { redirect: "manual" });
    const passed = expected.includes(response.status);
    console.log(`${passed ? "PASS" : "FAIL"} ${name} ${response.status} ${path}`);
    if (!passed) failed = true;
  } catch (error) {
    failed = true;
    console.error(`FAIL ${name}`, error);
  }
}

if (failed) process.exit(1);
console.log("Production smoke test passed.");
