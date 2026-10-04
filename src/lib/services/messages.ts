import "server-only";
import { query, transaction } from "@/lib/db";
import type { Profile } from "@/lib/types";
import type { ChatMessage, ConversationRow, MessageCategory, MessageSummary, NotificationRow } from "@/lib/message-types";
import { MessageError } from "@/lib/message-validation";

const pageSize = 20;
const conversationSelect = `select c.id, p.display_name, p.avatar_url, c.updated_at,
  latest.body as preview, coalesce(unread.count, 0)::int as unread,
  l.image_url, coalesce(o.description, l.title) as context_title,
  case when c.order_id is not null then '/orders/' || c.order_id else '/marketplace/' || c.listing_id end as href
  from conversations c
  join profiles p on p.id = case when c.member_a = $1 then c.member_b else c.member_a end
  left join orders o on o.id = c.order_id
  left join marketplace_listings l on l.id = c.listing_id
  left join lateral (select body from chat_messages where conversation_id = c.id order by id desc limit 1) latest on true
  left join lateral (select count(*) from chat_messages where conversation_id = c.id and sender_id <> $1 and read_at is null) unread on true
  where $1 in (c.member_a, c.member_b)`;

export async function messageSummary(userId: string): Promise<MessageSummary> {
  const result = await query<MessageSummary["categories"][number] & { chat_unread: number }>(
    `with chat as (select count(*)::int as count from chat_messages m join conversations c on c.id = m.conversation_id
      where $1 in (c.member_a, c.member_b) and m.sender_id <> $1 and m.read_at is null)
     select cat.category, chat.count as chat_unread, (select count(*)::int from notifications n where n.recipient_id = $1 and n.category = cat.category and n.read_at is null) as unread,
     latest.body as preview, latest.created_at
     from (values ('order'), ('system')) cat(category) cross join chat
     left join lateral (select body, created_at from notifications where recipient_id = $1 and category = cat.category order by id desc limit 1) latest on true`, [userId]);
  const categories = result.rows.map(({ category, unread, preview, created_at }) => ({ category, unread, preview, created_at }));
  return { categories, total: categories.reduce((n, row) => n + row.unread, result.rows[0]?.chat_unread ?? 0) };
}

export async function listConversations(userId: string, search: string, offset: number) {
  const result = await query<ConversationRow>(`${conversationSelect}
    and strpos(lower(p.display_name), lower($2)) > 0
    order by c.updated_at desc, c.id desc limit $3 offset $4`, [userId, search, pageSize + 1, offset]);
  return { conversations: result.rows.slice(0, pageSize), hasMore: result.rows.length > pageSize };
}

export async function readThread(userId: string, id: string, before?: string, after?: string) {
  const threadSelect = conversationSelect.replace("select c.id,", `select c.id,
    (select max(m.id)::text from chat_messages m where m.conversation_id = c.id
      and m.sender_id = $1 and m.read_at is not null) as read_through,`);
  const result = await query<ConversationRow & { read_through: string | null }>(`${threadSelect} and c.id = $2`, [userId, id]);
  if (!result.rows[0]) throw new MessageError("会话不存在或无权访问", 404);
  const messages = await query<ChatMessage>(`select id::text, sender_id, body, created_at, read_at from chat_messages
    where conversation_id = $1 and ($2::bigint is null or chat_messages.id < $2::bigint)
    and ($3::bigint is null or chat_messages.id > $3::bigint)
    order by chat_messages.id ${after ? "asc" : "desc"} limit 41`, [id, before || null, after || null]);
  const page = messages.rows.slice(0, 40);
  return { conversation: result.rows[0], messages: after ? page : page.reverse(), hasMore: messages.rows.length > 40, userId, readThrough: result.rows[0].read_through };
}

export async function listNotifications(userId: string, category: MessageCategory, before?: string) {
  const result = await query<NotificationRow>(`select id::text, title, body, href, created_at, read_at from notifications
    where recipient_id = $1 and category = $2 and ($3::bigint is null or notifications.id < $3::bigint) order by notifications.id desc limit 21`, [userId, category, before || null]);
  return { notifications: result.rows.slice(0, pageSize), hasMore: result.rows.length > pageSize };
}

export async function startConversation(profile: Profile, kind: "order" | "listing", id: string) {
  return transaction(async (client) => {
    let peerId: string | null = null;
    if (kind === "order") {
      const { rows } = await client.query<{ publisher_id: string; runner_id: string | null }>("select publisher_id, runner_id from orders where id = $1 for share", [id]);
      const order = rows[0];
      if (!order || !order.runner_id || ![order.publisher_id, order.runner_id].includes(profile.id)) throw new MessageError("仅已接单的订单双方可以聊天", 403);
      peerId = order.publisher_id === profile.id ? order.runner_id : order.publisher_id;
    } else {
      const { rows } = await client.query<{ seller_id: string; campus_id: string; status: string }>("select seller_id, campus_id, status from marketplace_listings where id = $1 for share", [id]);
      const listing = rows[0];
      if (!listing || listing.seller_id === profile.id || listing.campus_id !== profile.campus_id || listing.status !== "ACTIVE") throw new MessageError("仅可咨询同校在售商品", 403);
      peerId = listing.seller_id;
    }
    const peer = await client.query("select id from profiles where id = $1 and status = 'active'", [peerId]);
    if (!peer.rowCount) throw new MessageError("对方账号暂不可接收消息", 403);
    const [a, b] = [profile.id, peerId].sort();
    const column = kind === "order" ? "order_id" : "listing_id";
    const result = await client.query<{ id: string }>(`insert into conversations(member_a, member_b, ${column}) values ($1, $2, $3)
      on conflict (member_a, member_b, ${column}) where ${column} is not null do update set member_a = excluded.member_a returning id`, [a, b, id]);
    return result.rows[0];
  });
}

export async function sendMessage(userId: string, id: string, body: string, clientId: string) {
  return transaction(async (client) => {
    // Serialize sends per conversation; read watermarks cannot swallow a later send.
    const member = await client.query(`select c.id from conversations c
      join profiles a on a.id = c.member_a join profiles b on b.id = c.member_b
      where c.id = $1 and $2 in (c.member_a, c.member_b) and a.status = 'active' and b.status = 'active' for update of c`, [id, userId]);
    if (!member.rowCount) throw new MessageError("会话不存在或当前无法发送", 403);
    const result = await client.query(`insert into chat_messages(conversation_id, sender_id, body, client_id) values ($1, $2, $3, $4)
      on conflict (sender_id, client_id) do nothing returning id`, [id, userId, body, clientId]);
    if (result.rowCount) await client.query("update conversations set updated_at = clock_timestamp() where id = $1", [id]);
    return { ok: true };
  });
}

export async function markThreadRead(userId: string, id: string, through: string) {
  // Only IDs actually returned to this participant may be used as a watermark.
  await query(`update chat_messages m set read_at = now() from conversations c
    where c.id = m.conversation_id and c.id = $1 and $2 in (c.member_a, c.member_b)
    and m.sender_id <> $2 and m.read_at is null and m.id <= $3::bigint
    and exists (select 1 from chat_messages seen where seen.id = $3::bigint and seen.conversation_id = c.id)`, [id, userId, through]);
}

export async function markNotificationsRead(userId: string, category: MessageCategory, ids: string[]) {
  await query("update notifications set read_at = now() where recipient_id = $1 and category = $2 and id = any($3::bigint[]) and read_at is null", [userId, category, ids]);
}

export async function markAllRead(userId: string) {
  // One SQL snapshot: messages arriving after this action stay unread.
  await query(`with marked as (
    update notifications set read_at = now() where recipient_id = $1 and read_at is null returning id
  ) update chat_messages m set read_at = now() from conversations c
    where c.id = m.conversation_id and $1 in (c.member_a, c.member_b) and m.sender_id <> $1 and m.read_at is null`, [userId]);
}

export async function publishAnnouncement(profile: Profile, title: string, body: string) {
  if (profile.role !== "admin") throw new MessageError("仅管理员可发布公告", 403);
  await query(`insert into notifications(recipient_id, category, title, body)
    select id, 'system', $1, $2 from profiles where status = 'active'`, [title, body]);
}
