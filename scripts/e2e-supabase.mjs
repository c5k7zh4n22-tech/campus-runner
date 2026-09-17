import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  console.error("Missing Supabase production test environment variables.");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const runId = Date.now().toString(36);
const users = [];
let publisher;
let runner;
let orderId;
let secondOrderId;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createConfirmedUser(label) {
  const email = `campus-runner-e2e-${label}-${runId}@example.com`;
  const password = `Test-${runId}-${label}-Passw0rd!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `E2E ${label}` }
  });
  if (error) throw error;
  assert(data.user, "User was not created");
  users.push({ id: data.user.id, email, password });
  return { id: data.user.id, email, password };
}

async function signIn(user) {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  return client;
}

async function expectFailure(promise, label) {
  const { error } = await promise;
  assert(error, `Expected failure: ${label}`);
  return error;
}

async function cleanup() {
  try {
    const ids = users.map((user) => user.id);
    if (ids.length) {
      await admin.from("reports").delete().in("reporter_id", ids);
      await admin.from("reviews").delete().in("reviewer_id", ids);
      await admin.from("orders").delete().in("publisher_id", ids);
    }
  } finally {
    for (const user of users) {
      await admin.auth.admin.deleteUser(user.id);
    }
  }
}

try {
  console.log("1/10 Creating two confirmed production test users...");
  publisher = await createConfirmedUser("publisher");
  runner = await createConfirmedUser("runner");

  const publisherClient = await signIn(publisher);
  const runnerClient = await signIn(runner);

  const { data: activeCampuses, error: campusError } = await admin
    .from("campuses")
    .select("id,name")
    .eq("is_active", true);
  if (campusError) throw campusError;
  assert(activeCampuses.length === 1 && activeCampuses[0].name === "莆田学院", "Only Putian University should be active");
  const campus = activeCampuses[0];

  const { error: profileError } = await admin.from("profiles").upsert([
    { id: publisher.id, display_name: "E2E 发布者", campus_id: campus.id, phone: null, student_id: null, verification_status: "unverified", status: "active", role: "admin" },
    { id: runner.id, display_name: "E2E 跑腿员", campus_id: campus.id, phone: null, student_id: null, verification_status: "unverified", status: "active", role: "user" }
  ]);
  if (profileError) throw profileError;

  console.log("2/10 Verifying the 12-digit student ID policy...");
  await expectFailure(publisherClient.rpc("submit_verification", { p_student_id: "12345", p_phone: "13800138000" }), "short student ID");
  await expectFailure(publisherClient.rpc("submit_verification", { p_student_id: "202600000001", p_phone: "" }), "missing phone");
  const studentBase = Date.now().toString().slice(-10);
  const publisherStudentId = `10${studentBase}`;
  const runnerStudentId = `11${studentBase}`;
  const { data: publisherVerification, error: publisherVerificationError } = await publisherClient.rpc("submit_verification", {
    p_student_id: publisherStudentId,
    p_phone: "13800138000"
  });
  if (publisherVerificationError) throw publisherVerificationError;
  assert(publisherVerification.verification_status === "pending", "Publisher verification was not submitted");
  const { error: runnerVerificationError } = await runnerClient.rpc("submit_verification", {
    p_student_id: runnerStudentId,
    p_phone: "13900139000"
  });
  if (runnerVerificationError) throw runnerVerificationError;
  const { error: approvePublisherError } = await publisherClient.rpc("admin_review_verification", {
    p_user_id: publisher.id,
    p_status: "verified"
  });
  if (approvePublisherError) throw approvePublisherError;
  const { error: approveRunnerError } = await publisherClient.rpc("admin_review_verification", {
    p_user_id: runner.id,
    p_status: "verified"
  });
  if (approveRunnerError) throw approveRunnerError;

  console.log("3/10 Publishing an order...");
  const deadlineA = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const { data: createdOrder, error: createError } = await publisherClient.rpc("create_order", {
    p_campus_id: campus.id,
    p_pickup_location: "E2E 测试取货点 A",
    p_delivery_location: "E2E 测试送达点 A",
    p_description: "生产环境端到端测试订单 A",
    p_reward: 12.5,
    p_deadline: deadlineA
  });
  if (createError) throw createError;
  orderId = createdOrder.id;

  const { data: visibleOrder, error: visibleError } = await runnerClient
    .from("orders")
    .select("id,publisher_id,runner_id,status")
    .eq("id", orderId)
    .single();
  if (visibleError) throw visibleError;
  assert(visibleOrder.status === "PENDING", "New order must be pending");

  console.log("4/10 Verifying private contact and RLS isolation...");
  await expectFailure(runnerClient.rpc("get_order_contact", { p_order_id: orderId }), "contact before acceptance");
  const { data: hiddenProfile } = await runnerClient.from("profiles").select("id,phone").eq("id", publisher.id).maybeSingle();
  assert(!hiddenProfile, "RLS exposed another user's private profile");

  console.log("5/10 Testing atomic acceptance and duplicate prevention...");
  await expectFailure(publisherClient.rpc("accept_order", { p_order_id: orderId }), "publisher accepting own order");
  const { data: acceptedOrder, error: acceptError } = await runnerClient.rpc("accept_order", { p_order_id: orderId });
  if (acceptError) throw acceptError;
  assert(acceptedOrder.runner_id === runner.id && acceptedOrder.status === "ACCEPTED", "Atomic accept failed");
  await expectFailure(runnerClient.rpc("accept_order", { p_order_id: orderId }), "duplicate acceptance");

  const { data: contact, error: contactError } = await publisherClient.rpc("get_order_contact", { p_order_id: orderId });
  if (contactError) throw contactError;
  assert(contact?.[0]?.phone === "13900139000", "Required participant phone lookup failed");
  assert(contact?.[0]?.email?.includes("campus-runner-e2e-runner"), "Participant email lookup failed");

  console.log("6/10 Testing invalid reward and past deadline...");
  await expectFailure(publisherClient.rpc("create_order", {
    p_campus_id: campus.id,
    p_pickup_location: "A",
    p_delivery_location: "B",
    p_description: "Invalid reward test",
    p_reward: 0,
    p_deadline: deadlineA
  }), "non-positive reward");
  await expectFailure(publisherClient.rpc("create_order", {
    p_campus_id: campus.id,
    p_pickup_location: "A",
    p_delivery_location: "B",
    p_description: "Past deadline test",
    p_reward: 5,
    p_deadline: new Date(Date.now() - 60_000).toISOString()
  }), "past deadline");

  console.log("7/10 Testing full legal status flow...");
  const { error: startError } = await runnerClient.rpc("transition_order", { p_order_id: orderId, p_action: "start" });
  if (startError) throw startError;
  const { error: submitError } = await runnerClient.rpc("transition_order", { p_order_id: orderId, p_action: "submit" });
  if (submitError) throw submitError;
  const { data: completedOrder, error: confirmError } = await publisherClient.rpc("transition_order", { p_order_id: orderId, p_action: "confirm" });
  if (confirmError) throw confirmError;
  assert(completedOrder.status === "COMPLETED", "Order status flow did not complete");

  console.log("8/10 Testing reviews and duplicate prevention...");
  const { error: publisherReviewError } = await publisherClient.from("reviews").insert({
    order_id: orderId,
    reviewer_id: publisher.id,
    reviewee_id: runner.id,
    rating: 5,
    comment: "E2E publisher review"
  });
  if (publisherReviewError) throw publisherReviewError;
  const { error: runnerReviewError } = await runnerClient.from("reviews").insert({
    order_id: orderId,
    reviewer_id: runner.id,
    reviewee_id: publisher.id,
    rating: 5,
    comment: "E2E runner review"
  });
  if (runnerReviewError) throw runnerReviewError;
  await expectFailure(publisherClient.from("reviews").insert({
    order_id: orderId,
    reviewer_id: publisher.id,
    reviewee_id: runner.id,
    rating: 4
  }), "duplicate review");

  console.log("9/10 Testing report creation and admin authorization...");
  const { error: reportError } = await runnerClient.from("reports").insert({
    reporter_id: runner.id,
    order_id: orderId,
    reason: "other",
    details: "E2E production report test"
  });
  if (reportError) throw reportError;

  const { error: adminStatusError } = await publisherClient.rpc("admin_set_user_status", {
    p_user_id: runner.id,
    p_status: "suspended"
  });
  if (adminStatusError) throw adminStatusError;
  const { error: restoreStatusError } = await publisherClient.rpc("admin_set_user_status", {
    p_user_id: runner.id,
    p_status: "active"
  });
  if (restoreStatusError) throw restoreStatusError;

  console.log("10/10 Testing multi-user data persistence without overwrite...");
  const { data: secondOrder, error: secondCreateError } = await runnerClient.rpc("create_order", {
    p_campus_id: campus.id,
    p_pickup_location: "E2E 测试取货点 B",
    p_delivery_location: "E2E 测试送达点 B",
    p_description: "生产环境端到端测试订单 B",
    p_reward: 6,
    p_deadline: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
  });
  if (secondCreateError) throw secondCreateError;
  secondOrderId = secondOrder.id;
  const { data: bothOrders, error: bothOrdersError } = await admin
    .from("orders")
    .select("id,publisher_id,description")
    .in("id", [orderId, secondOrderId]);
  if (bothOrdersError) throw bothOrdersError;
  assert(bothOrders.length === 2, "Expected two persisted orders");
  assert(bothOrders.some((row) => row.id === orderId && row.publisher_id === publisher.id), "Publisher data overwritten");
  assert(bothOrders.some((row) => row.id === secondOrderId && row.publisher_id === runner.id), "Runner data overwritten");

  console.log("PASS: production Supabase flow completed successfully.");
} finally {
  await cleanup();
}