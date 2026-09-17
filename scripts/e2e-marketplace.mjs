import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRoleKey) {
  console.error("Missing production Supabase environment variables.");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const runId = Date.now().toString(36);
const users = [];
let listingId;
let interestId;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createUser(label) {
  const email = "campus-market-" + label + "-" + runId + "@example.com";
  const password = "Market-" + runId + "-" + label + "-Passw0rd!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Market " + label }
  });
  if (error) throw error;
  if (!data.user) throw new Error("User creation failed");
  users.push({ id: data.user.id });
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

async function expectFailure(promise, label) {
  const { error } = await promise;
  assert(Boolean(error), "Expected failure: " + label);
}

async function cleanup() {
  const ids = users.map((user) => user.id);
  try {
    if (ids.length) {
      await admin.from("marketplace_interests").delete().in("buyer_id", ids);
      await admin.from("marketplace_listings").delete().in("seller_id", ids);
    }
  } finally {
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  }
}

try {
  console.log("1/6 Creating seller and buyer...");
  const seller = await createUser("seller");
  const buyer = await createUser("buyer");

  const { data: campuses, error: campusError } = await admin.from("campuses").select("id,name").eq("is_active", true);
  if (campusError) throw campusError;
  const campus = campuses.find((item) => item.name === "莆田学院");
  assert(campus, "Putian University campus is missing");

  const { error: sellerProfileError } = await admin.from("profiles").update({
    campus_id: campus.id,
    verification_status: "verified",
    phone: "13800138000",
    student_id: "20" + Date.now().toString().slice(-10)
  }).eq("id", seller.id);
  if (sellerProfileError) throw sellerProfileError;

  const { error: buyerProfileError } = await admin.from("profiles").update({
    campus_id: campus.id,
    verification_status: "verified",
    phone: "13900139000",
    student_id: "21" + Date.now().toString().slice(-10)
  }).eq("id", buyer.id);
  if (buyerProfileError) throw buyerProfileError;

  console.log("2/6 Publishing a marketplace listing...");
  const { data: listing, error: listingError } = await seller.client.rpc("create_marketplace_listing", {
    p_title: "E2E 闲置教材",
    p_description: "生产环境闲置市场测试商品",
    p_price: 25.5,
    p_category: "books",
    p_item_condition: "good",
    p_image_url: null
  });
  if (listingError) throw listingError;
  listingId = listing.id;

  const { data: visibleListing, error: visibleError } = await buyer.client
    .from("marketplace_listings")
    .select("id,status,seller_id")
    .eq("id", listingId)
    .single();
  if (visibleError) throw visibleError;
  assert(visibleListing.status === "ACTIVE", "Buyer cannot see active listing");

  console.log("3/6 Sending a purchase interest...");
  await expectFailure(seller.client.rpc("create_marketplace_interest", { p_listing_id: listingId, p_message: "self buy" }), "seller buying own listing");
  const { data: interest, error: interestError } = await buyer.client.rpc("create_marketplace_interest", {
    p_listing_id: listingId,
    p_message: "我想要，今晚可以交易"
  });
  if (interestError) throw interestError;
  interestId = interest.id;

  const { data: sellerInterests, error: sellerInterestsError } = await seller.client
    .from("marketplace_interests")
    .select("*")
    .eq("listing_id", listingId);
  if (sellerInterestsError) throw sellerInterestsError;
  assert(sellerInterests.some((item) => item.id === interestId), "Seller cannot see buyer interest");

  console.log("4/6 Accepting the purchase interest...");
  const { error: acceptError } = await seller.client.rpc("respond_marketplace_interest", {
    p_interest_id: interestId,
    p_accept: true
  });
  if (acceptError) throw acceptError;

  const { data: reservedListing, error: reservedError } = await buyer.client
    .from("marketplace_listings")
    .select("status,buyer_id")
    .eq("id", listingId)
    .single();
  if (reservedError) throw reservedError;
  assert(reservedListing.status === "RESERVED" && reservedListing.buyer_id === buyer.id, "Listing was not reserved");

  const { data: contact, error: contactError } = await buyer.client.rpc("get_marketplace_contact", { p_listing_id: listingId });
  if (contactError) throw contactError;
  assert(contact?.[0]?.phone === "13800138000", "Buyer cannot view seller contact");

  console.log("5/6 Marking the listing sold...");
  const { data: sold, error: soldError } = await seller.client.rpc("mark_marketplace_listing_sold", { p_listing_id: listingId });
  if (soldError) throw soldError;
  assert(sold.status === "SOLD", "Listing was not marked sold");
  await expectFailure(buyer.client.rpc("create_marketplace_interest", { p_listing_id: listingId, p_message: "again" }), "interest on sold listing");

  console.log("6/6 Verifying persistence and RLS...");
  const { data: persisted, error: persistedError } = await admin
    .from("marketplace_listings")
    .select("id,status,title")
    .eq("id", listingId)
    .single();
  if (persistedError) throw persistedError;
  assert(persisted.title === "E2E 闲置教材" && persisted.status === "SOLD", "Marketplace data did not persist");

  console.log("PASS: marketplace production flow completed successfully.");
} finally {
  await cleanup();
}
