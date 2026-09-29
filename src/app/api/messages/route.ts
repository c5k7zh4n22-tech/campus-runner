import { getCurrentProfile } from "@/lib/data";
import { MessageError, messageMutationSchema, messageQuerySchema } from "@/lib/message-validation";
import { listConversations, listNotifications, markAllRead, markNotificationsRead, markThreadRead, messageSummary, publishAnnouncement, readThread, sendMessage, startConversation } from "@/lib/services/messages";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
async function currentProfile() {
  const profile = await getCurrentProfile();
  if (!profile) throw new MessageError("请先登录后查看消息", 401);
  if (profile.status !== "active") throw new MessageError("账号状态不可使用消息功能", 403);
  return profile;
}
function failure(error: unknown) {
  if (error instanceof MessageError) return json({ error: error.message }, error.status);
  console.error("Message request failed", error);
  return json({ error: "消息暂时无法加载，请稍后重试" }, 503);
}
export async function GET(request: Request) {
  try {
    const profile = await currentProfile();
    const parsed = messageQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return json({ error: "请求参数无效" }, 400);
    const input = parsed.data;
    if (input.view === "summary") return json(await messageSummary(profile.id));
    if (input.view === "thread") return json(await readThread(profile.id, input.id!, input.before, input.after));
    if (input.view === "notifications") return json(await listNotifications(profile.id, input.category!, input.before));
    const [list, summary] = await Promise.all([listConversations(profile.id, input.search, input.offset), messageSummary(profile.id)]);
    return json({ ...list, summary });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    // JSON-only, same-origin mutations protect cookie-authenticated endpoints.
    const origin = request.headers.get("origin");
    const allowed = new Set([new URL(request.url).origin]);
    for (const value of [process.env.APP_URL, process.env.NEXT_PUBLIC_SITE_URL]) {
      if (value) { try { allowed.add(new URL(value).origin); } catch { /* Ignore invalid optional config. */ } }
    }
    if (!origin || !allowed.has(origin) || !request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "请求来源无效" }, 403);
    if (Number(request.headers.get("content-length")) > 20000) return json({ error: "消息过长" }, 413);
    const profile = await currentProfile();
    const raw = await request.text();
    if (raw.length > 20000) return json({ error: "消息过长" }, 413);
    let value: unknown;
    try { value = JSON.parse(raw); } catch { return json({ error: "请求格式无效" }, 400); }
    const parsed = messageMutationSchema.safeParse(value);
    if (!parsed.success) return json({ error: "内容为空、过长或参数无效" }, 400);
    const input = parsed.data;
    switch (input.action) {
      case "start": return json(await startConversation(profile, input.kind, input.id));
      case "send": return json(await sendMessage(profile.id, input.id, input.body, input.clientId));
      case "read": await markThreadRead(profile.id, input.id, input.through); break;
      case "read-notifications": await markNotificationsRead(profile.id, input.category, input.ids); break;
      case "read-all": await markAllRead(profile.id); break;
      case "announce": await publishAnnouncement(profile, input.title, input.body); break;
    }
    return json({ ok: true });
  } catch (error) { return failure(error); }
}
