import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { Profile } from "./types";
import { messageMutationSchema, unreadLabel } from "./message-validation";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  query: (sql: string, values?: unknown[]) => pool.query(sql, values),
  transaction: async (fn: (client: import("pg").PoolClient) => Promise<unknown>) => {
    const client = await pool.connect();
    try { await client.query("begin"); const value = await fn(client); await client.query("commit"); return value; }
    catch (error) { await client.query("rollback"); throw error; }
    finally { client.release(); }
  }
}));
vi.mock("@/lib/data", () => ({ getCurrentProfile: async () => currentProfile }));
import { listConversations, listNotifications, markAllRead, markNotificationsRead, markThreadRead, messageSummary, publishAnnouncement, readThread, sendMessage, startConversation } from "./services/messages";
import { GET, POST } from "@/app/api/messages/route";

let pool: Pool;
let currentProfile: Profile | null = null;
const schema = `message_test_${randomUUID().replaceAll("-", "")}`;
let people: Profile[];
let orderId: string;
let listingId: string;

describe("message input boundaries", () => {
  it("rejects blank/oversized messages and invalid IDs", () => {
    const value = { action: "send", id: randomUUID(), clientId: randomUUID() };
    expect(messageMutationSchema.safeParse({ ...value, body: "  " }).success).toBe(false);
    expect(messageMutationSchema.safeParse({ ...value, body: "字".repeat(2001) }).success).toBe(false);
    expect(messageMutationSchema.safeParse({ ...value, id: "not-a-uuid", body: "你好" }).success).toBe(false);
    expect(messageMutationSchema.safeParse({ ...value, body: "你好" }).success).toBe(true);
    expect(unreadLabel(100)).toBe("99+");
    expect(unreadLabel(99)).toBe("99");
  });
});

describe.skipIf(!process.env.MESSAGE_TEST_DATABASE_URL)("PostgreSQL message integration", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.MESSAGE_TEST_DATABASE_URL, options: `-c search_path=${schema},public` });
    await pool.query(`create schema ${schema}`);
    await pool.query(await readFile("migrations/0001_postgres_app.sql", "utf8"));
    await pool.query(await readFile("migrations/0002_messages.sql", "utf8"));
    await pool.query(await readFile("migrations/0004_support.sql", "utf8"));
    await pool.query(await readFile("migrations/0006_carpool.sql", "utf8"));
  });
  afterAll(async () => {
    if (pool) { await pool.query(`drop schema ${schema} cascade`); await pool.end(); }
  });
  beforeEach(async () => {
    await pool.query("truncate app_users cascade");
    const campus = (await pool.query("select id from campuses limit 1")).rows[0].id;
    people = [];
    for (const name of ["小林", "小陈", "旁观同学", "管理员"]) {
      const id = randomUUID();
      await pool.query("insert into app_users(id, email, password_hash) values ($1, $2, 'test')", [id, `${id}@test.invalid`]);
      const profile = await pool.query<Profile>("insert into profiles(id, campus_id, display_name, verification_status, role) values ($1, $2, $3, 'verified', $4) returning *", [id, campus, name, name === "管理员" ? "admin" : "user"]);
      people.push(profile.rows[0]);
    }
    orderId = (await pool.query("insert into orders(publisher_id, runner_id, campus_id, pickup_location, delivery_location, description, reward, deadline, status) values ($1,$2,$3,'驿站','宿舍','取快递',8,now() + interval '1 day','ACCEPTED') returning id", [people[0].id, people[1].id, campus])).rows[0].id;
    listingId = (await pool.query("insert into marketplace_listings(seller_id,campus_id,title,description,price,category,item_condition) values ($1,$2,'台灯','九成新',20,'daily','good') returning id", [people[1].id, campus])).rows[0].id;
    currentProfile = people[0];
  });

  it("isolates conversations and read operations from a third account", async () => {
    const conversation = await startConversation(people[0], "order", orderId);
    await sendMessage(people[0].id, conversation.id, "取件码稍后发你", randomUUID());
    const thread = await readThread(people[1].id, conversation.id);
    expect(thread.messages).toHaveLength(1);
    await expect(readThread(people[2].id, conversation.id)).rejects.toMatchObject({ status: 404 });
    await expect(sendMessage(people[2].id, conversation.id, "越权", randomUUID())).rejects.toMatchObject({ status: 403 });
    await markThreadRead(people[2].id, conversation.id, thread.messages[0].id);
    await markAllRead(people[2].id);
    expect((await messageSummary(people[1].id)).total).toBe(1);
    expect((await listConversations(people[2].id, "", 0)).conversations).toHaveLength(0);
    await expect(startConversation(people[2], "order", orderId)).rejects.toMatchObject({ status: 403 });
    await expect(startConversation({ ...people[0], campus_id: null }, "listing", listingId)).rejects.toMatchObject({ status: 403 });
  });

  it("deduplicates retries and does not mark a later message read", async () => {
    const conversation = await startConversation(people[0], "listing", listingId);
    expect((await startConversation(people[0], "listing", listingId)).id).toBe(conversation.id);
    const clientId = randomUUID();
    await Promise.all([sendMessage(people[0].id, conversation.id, "还在吗", clientId), sendMessage(people[0].id, conversation.id, "还在吗", clientId)]);
    const thread = await readThread(people[1].id, conversation.id);
    expect(thread.messages).toHaveLength(1);
    await sendMessage(people[0].id, conversation.id, "想看看", randomUUID());
    await markThreadRead(people[1].id, conversation.id, thread.messages[0].id);
    const receipt = await readThread(people[0].id, conversation.id, undefined, thread.messages[0].id);
    expect(receipt.readThrough).toBe(thread.messages[0].id);
    expect(receipt.messages).toHaveLength(1);
    expect((await messageSummary(people[1].id)).total).toBe(1);
    await markAllRead(people[1].id);
    await sendMessage(people[0].id, conversation.id, "明天可以吗", randomUUID());
    expect((await messageSummary(people[1].id)).total).toBe(1);
  });

  it("generates order and verification notifications in the business transaction", async () => {
    await pool.query("update orders set status = 'IN_PROGRESS' where id=$1", [orderId]);
    expect((await listNotifications(people[0].id, "order")).notifications[0].title).toContain("配送");
    expect((await listNotifications(people[1].id, "order")).notifications).toHaveLength(1);
    expect((await listNotifications(people[2].id, "order")).notifications).toHaveLength(0);
    await pool.query("update profiles set verification_status='rejected' where id=$1", [people[0].id]);
    const notices = await listNotifications(people[0].id, "system");
    await markNotificationsRead(people[2].id, "system", [notices.notifications[0].id]);
    expect((await listNotifications(people[0].id, "system")).notifications[0].read_at).toBeNull();
    await markNotificationsRead(people[0].id, "system", [notices.notifications[0].id]);
    expect((await listNotifications(people[0].id, "system")).notifications[0].read_at).not.toBeNull();
    const client = await pool.connect();
    try { await client.query("begin"); await client.query("update orders set status='COMPLETED' where id=$1", [orderId]); await client.query("rollback"); }
    finally { client.release(); }
    expect((await listNotifications(people[0].id, "order")).notifications).toHaveLength(1);
  });

  it("paginates conversations/history, searches nicknames and counts 100+ unread", async () => {
    for (let i = 0; i < 23; i++) {
      const listing = (await pool.query("insert into marketplace_listings(seller_id,campus_id,title,description,price,category,item_condition) values ($1,$2,$3,'描述',1,'daily','good') returning id", [people[1].id, people[0].campus_id, `商品${i}`])).rows[0];
      await startConversation(people[0], "listing", listing.id);
    }
    const first = await listConversations(people[0].id, "小陈", 0);
    const second = await listConversations(people[0].id, "小陈", 20);
    expect(first.conversations).toHaveLength(20); expect(first.hasMore).toBe(true);
    expect(second.conversations).toHaveLength(3); expect(second.hasMore).toBe(false);
    expect(new Set([...first.conversations, ...second.conversations].map((row) => row.id)).size).toBe(23);
    expect((await listConversations(people[0].id, "%", 0)).conversations).toHaveLength(0);
    const id = first.conversations[0].id;
    await pool.query("insert into chat_messages(conversation_id,sender_id,body,client_id) select $1,$2,'你好 ' || n,gen_random_uuid() from generate_series(1,105) n", [id, people[0].id]);
    const latest = await readThread(people[1].id, id);
    const older = await readThread(people[1].id, id, latest.messages[0].id);
    expect(latest.messages).toHaveLength(40); expect(older.messages).toHaveLength(40);
    expect(new Set([...latest.messages, ...older.messages].map((row) => row.id)).size).toBe(80);
    const catchup = await readThread(people[1].id, id, undefined, older.messages[0].id);
    expect(catchup.messages).toHaveLength(40);
    expect(catchup.hasMore).toBe(true);
    expect(BigInt(catchup.messages[0].id)).toBeGreaterThan(BigInt(older.messages[0].id));
    expect((await messageSummary(people[1].id)).total).toBe(105);
  });

  it("enforces authentication, mutation origin, account status and admin privileges", async () => {
    currentProfile = null;
    expect((await GET(new Request("http://localhost/api/messages"))).status).toBe(401);
    currentProfile = people[0];
    const request = (body: unknown, origin = "http://localhost") => new Request("http://localhost/api/messages", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
    expect((await POST(request({ action: "read-all" }, "https://evil.example"))).status).toBe(403);
    expect((await POST(request({ action: "announce", title: "公告", body: "内容" }))).status).toBe(403);
    await publishAnnouncement(people[3], "校园提醒", "明天有活动");
    expect((await listNotifications(people[0].id, "system")).notifications[0].title).toBe("校园提醒");
    currentProfile = { ...people[0], status: "banned" };
    expect((await GET(new Request("http://localhost/api/messages"))).status).toBe(403);
    expect((await POST(request({ action: "read-all" }))).status).toBe(403);
    currentProfile = people[0];
    expect((await GET(new Request("http://localhost/api/messages?view=thread&id=wrong"))).status).toBe(400);
  });
});
