import "server-only";
import type { PoolClient } from "pg";
import type { SupportImage } from "./support-images";
import { query, transaction } from "@/lib/db";
import type { Profile } from "@/lib/types";
import { canChangeSupportStatus, SUPPORT_STATUSES, SupportError, type SupportTicket, type SupportEntry, type SupportStatus } from "@/lib/support";

function active(profile: Profile) { if (profile.status !== "active") throw new SupportError("当前账号无法使用客服功能", 403); }
async function saveImages(client: PoolClient, entryId: string, images: SupportImage[]) {
  for (const [position, image] of images.entries()) {
    await client.query("insert into support_attachments(entry_id,position,content_type,data) values($1,$2,$3,$4)", [entryId, position, image.contentType, image.data]);
  }
}
export async function getSupportImage(profile: Profile, id: string) {
  active(profile);
  const result = await query<{ data: Buffer; content_type: string }>(`select a.data,a.content_type from support_attachments a
    join support_entries e on e.id=a.entry_id join support_tickets t on t.id=e.ticket_id
    where a.id=$1 and (t.owner_id=$2 or $3::boolean)`, [id, profile.id, profile.role === "admin"]);
  if (!result.rows[0]) throw new SupportError("截图不存在或无权查看", 404);
  return result.rows[0];
}
const selectTicket = `select t.*, p.display_name as owner_name, a.display_name as agent_name from support_tickets t
  join profiles p on p.id=t.owner_id left join profiles a on a.id=t.assigned_to`;
async function notify(client: PoolClient, ticket: { id: string; owner_id: string; assigned_to: string | null }, actorId: string, title: string) {
  const href = `/support/${ticket.id}`;
  if (actorId !== ticket.owner_id) {
    await client.query("insert into notifications(recipient_id,category,title,body,href) values($1,'system',$2,'客服售后有新进度，请查看工单详情。',$3)", [ticket.owner_id, title, href]);
  } else {
    await client.query(`insert into notifications(recipient_id,category,title,body,href)
      select id,'system',$1,'有用户提交或补充了售后问题，请及时查看。',$2 from profiles
      where role='admin' and status='active' and id<>$3 and ($4::uuid is null or id=$4)`, [title, href, actorId, ticket.assigned_to]);
  }
}
export async function listSupport(profile: Profile, admin: boolean, page: number, status?: SupportStatus) {
  active(profile);
  if (admin && profile.role !== "admin") throw new SupportError("无权查看客服后台", 403);
  const result = await query<SupportTicket>(`${selectTicket} where ($1::boolean or t.owner_id=$2)
    and ($3::text is null or t.status=$3) order by t.updated_at desc,t.id desc limit 21 offset $4`, [admin, profile.id, status || null, page * 20]);
  return { tickets: result.rows.slice(0,20), hasMore: result.rows.length > 20 };
}
export async function supportOrders(profile: Profile, page: number) {
  active(profile);
  const result = await query<{ id: string; description: string; status: string }>(`select id,description,status from orders
    where publisher_id=$1 or runner_id=$1 order by created_at desc,id desc limit 21 offset $2`, [profile.id, page * 20]);
  return { orders: result.rows.slice(0,20), hasMore: result.rows.length > 20 };
}
export async function getSupport(profile: Profile, id: string, before?: string) {
  active(profile);
  const result = await query<SupportTicket>(`${selectTicket} where t.id=$1 and (t.owner_id=$2 or $3::boolean)`, [id, profile.id, profile.role === "admin"]);
  const ticket = result.rows[0];
  if (!ticket) throw new SupportError("工单不存在或无权查看", 404);
  const entries = await query<SupportEntry>(`select id::text,actor_id,actor_role,body,kind,status,created_at,
    coalesce((select json_agg(json_build_object('id',a.id) order by a.position) from support_attachments a where a.entry_id=support_entries.id),'[]'::json) as attachments from support_entries
    where ticket_id=$1 and ($2::bigint is null or support_entries.id<$2::bigint) order by support_entries.id desc limit 41`, [id,before || null]);
  return { ticket, entries: entries.rows.slice(0,40).reverse(), hasMore: entries.rows.length > 40, isAdmin: profile.role === "admin", isOwner: ticket.owner_id === profile.id };
}
export async function createSupport(profile: Profile, input: { category: string; subject: string; body: string; orderId?: string; clientId: string }, images: SupportImage[] = []) {
  active(profile);
  return transaction(async (client) => {
    // Serialize creates for this user, including duplicate requests and limits.
    await client.query("select id from profiles where id=$1 for update", [profile.id]);
    const existing = await client.query<{ id: string }>("select id from support_tickets where owner_id=$1 and client_id=$2", [profile.id,input.clientId]);
    if (existing.rowCount) return existing.rows[0];
    if (["order","refund"].includes(input.category) && !input.orderId) throw new SupportError("订单与退款问题请选择关联订单");
    if (input.orderId) {
      const order = await client.query("select id from orders where id=$1 and (publisher_id=$2 or runner_id=$2)", [input.orderId,profile.id]);
      if (!order.rowCount) throw new SupportError("只能关联本人发布或接取的订单",403);
    }
    const count = await client.query<{ count: number }>("select count(*)::int as count from support_tickets where owner_id=$1 and created_at > now()-interval '1 hour'", [profile.id]);
    if (count.rows[0].count >= 5) throw new SupportError("提交较频繁，请在已有工单中补充问题，或稍后再试",429);
    const result = await client.query<{ id: string; owner_id: string; assigned_to: string | null }>(`insert into support_tickets(owner_id,order_id,category,subject,client_id)
      values($1,$2,$3,$4,$5) returning id,owner_id,assigned_to`, [profile.id,input.orderId || null,input.category,input.subject,input.clientId]);
    const ticket = result.rows[0];
    const entry = await client.query<{ id: string }>("insert into support_entries(ticket_id,actor_id,actor_role,body,kind,client_id) values($1,$2,'user',$3,'message',$4) returning id", [ticket.id,profile.id,input.body,input.clientId]);
    await saveImages(client, entry.rows[0].id, images);
    await notify(client,ticket,profile.id,"收到新的售后申请");
    return { id: ticket.id };
  });
}
export async function updateSupport(profile: Profile, input: { action: "reply" | "status"; id: string; body: string; clientId: string; status?: SupportStatus; version?: number }, images: SupportImage[] = []) {
  active(profile);
  return transaction(async (client) => {
    const result = await client.query<SupportTicket>("select * from support_tickets where id=$1 and (owner_id=$2 or $3::boolean) for update", [input.id,profile.id,profile.role === "admin"]);
    const ticket = result.rows[0];
    if (!ticket) throw new SupportError("工单不存在或无权操作",404);
    const duplicate = await client.query<{ ticket_id: string }>("select ticket_id from support_entries where actor_id=$1 and client_id=$2", [profile.id,input.clientId]);
    if (duplicate.rowCount) {
      if (duplicate.rows[0].ticket_id !== ticket.id) throw new SupportError("请求标识已使用，请重新提交",409);
      return { ok: true };
    }
    // An administrator submitting their own ticket acts as its owner.
    const admin = profile.role === "admin" && ticket.owner_id !== profile.id;
    let next = ticket.status;
    if (input.action === "status") {
      if (ticket.version !== input.version) throw new SupportError("工单已更新，请刷新后重试",409);
      if (!input.status || !canChangeSupportStatus(ticket.status,input.status,admin)) throw new SupportError("当前身份或状态不允许此操作",403);
      next = input.status;
    } else {
      if (["CLOSED","RESOLVED"].includes(ticket.status)) throw new SupportError("请先重新打开工单，再补充消息",409);
      const recent = await client.query<{ count: number }>("select count(*)::int as count from support_entries where actor_id=$1 and ticket_id=$2 and created_at>now()-interval '1 minute'", [profile.id,ticket.id]);
      if (recent.rows[0].count >= 10) throw new SupportError("回复较频繁，请稍后再试",429);
      next = admin ? "WAITING_USER" : ticket.status === "WAITING_USER" ? "PROCESSING" : ticket.status;
    }
    const assigned = admin ? profile.id : ticket.assigned_to;
    const content = input.action === "status" ? `状态变更：${SUPPORT_STATUSES[ticket.status]} → ${SUPPORT_STATUSES[next]}\n${input.body}` : input.body;
    const entry = await client.query<{ id: string }>("insert into support_entries(ticket_id,actor_id,actor_role,body,kind,status,client_id) values($1,$2,$3,$4,$5,$6,$7) returning id", [ticket.id,profile.id,admin ? "admin" : "user",content,input.action === "status" ? "status" : "message",next,input.clientId]);
    await saveImages(client, entry.rows[0].id, images);
    await client.query("update support_tickets set status=$1,assigned_to=$2,version=version+1,updated_at=clock_timestamp() where id=$3", [next,assigned,ticket.id]);
    await notify(client,{...ticket,assigned_to:assigned},profile.id,input.action === "reply" ? "售后工单有新回复" : `售后工单${SUPPORT_STATUSES[next]}`);
    return { ok: true };
  });
}
