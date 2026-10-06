import "server-only";
import type { PoolClient } from "pg";
import { query,transaction } from "@/lib/db";
import type { Profile } from "@/lib/types";
import { CarpoolError,maskCarpoolName,GENDER_PREFERENCE,type GenderPreference,type CarpoolMutation,type CarpoolTrip,type CarpoolPlace,type CarpoolMember,type CarpoolMessage } from "@/lib/carpool";

function active(p:Profile){if(p.status!=="active")throw new CarpoolError("账号暂不可使用拼车",403);}
function verified(p:Profile){active(p);if(p.verification_status!=="verified"||!p.campus_id)throw new CarpoolError("请先完成校园认证",403);}
const CARPOOL_SERVICE_FEE_CENTS = 9;
const tripSelect=`select t.id,t.owner_id,t.origin_id,t.destination_id,o.name as origin,d.name as destination,t.departure_start,t.departure_end,t.capacity,t.luggage,t.gender_preference,t.status,t.version,
 p.display_name as host_name,coalesce(n.occupied,0)::int as occupied,me.status as my_status,me.party_size as my_size,
 case when t.status<>'OPEN' then t.status when t.departure_end<=now() then 'EXPIRED' when n.occupied>=t.capacity then 'FULL' else 'OPEN' end as display_status
 from carpool_trips t join carpool_places o on o.id=t.origin_id join carpool_places d on d.id=t.destination_id join profiles p on p.id=t.owner_id
 left join lateral(select sum(party_size) as occupied from carpool_members where trip_id=t.id and status='APPROVED') n on true
 left join carpool_members me on me.trip_id=t.id and me.user_id=$1`;
export async function carpoolPlaces(p:Profile){active(p);return {places:(await query<CarpoolPlace>("select id,name,active from carpool_places where campus_id=$1 and (active or $2::boolean) order by name",[p.campus_id,p.role==="admin"])).rows};}
export async function listCarpools(p:Profile,input:{mine:string;origin?:string;destination?:string;originText?:string;destinationText?:string;from?:string;to?:string;gender?:GenderPreference;page:number}){
 active(p);
 await autoCompleteDueTrips();
 const result=await query<CarpoolTrip>(`${tripSelect} where t.campus_id=$2 and
 (($3::boolean and me.user_id is not null) or (not $3::boolean and t.status='OPEN' and t.departure_end>now()))
 and ($4::uuid is null or t.origin_id=$4) and ($5::uuid is null or t.destination_id=$5)
 and ($6::timestamptz is null or t.departure_end>=$6) and ($7::timestamptz is null or t.departure_start<$7)
 and ($9::text is null or t.gender_preference=$9)
 and ($10::text is null or strpos(lower(o.name),lower($10))>0)
 and ($11::text is null or strpos(lower(d.name),lower($11))>0)
 order by t.departure_start,t.id limit 21 offset $8`,[p.id,p.campus_id,input.mine==="true",input.origin||null,input.destination||null,input.from||null,input.to||null,input.page*20,input.gender||null,input.originText?.trim()||null,input.destinationText?.trim()||null]);
 return {trips:result.rows.slice(0,20).map(t=>({...t,host_name:maskCarpoolName(t.host_name)})),hasMore:result.rows.length>20};
}
export async function carpoolDetail(p:Profile,id:string){
 active(p);
 return transaction(async c=>{
 await autoCompleteDueTrips(c);
 await lockTrip(c,p,id);
 const trip=(await c.query<CarpoolTrip>(`${tripSelect} where t.id=$2 and t.campus_id=$3`,[p.id,id,p.campus_id])).rows[0];
 if(!trip)throw new CarpoolError("行程不存在或无权查看",404);
 const canChat=trip.my_status==="APPROVED",isOwner=trip.owner_id===p.id;
 const meeting=canChat?(await c.query<{meeting:string}>("select meeting from carpool_trips where id=$1",[id])).rows[0].meeting:null;
 const members=canChat?(await c.query<CarpoolMember>(`select m.user_id,p.display_name as name,m.party_size,m.status from carpool_members m join profiles p on p.id=m.user_id
 where trip_id=$1 and (m.status='APPROVED' or ($2::boolean and m.status in ('PENDING','PAYMENT_PENDING'))) order by m.created_at,m.user_id`,[id,isOwner])).rows.map(m=>({...m,name:maskCarpoolName(m.name)})):[];
 return {trip:{...trip,host_name:maskCarpoolName(trip.host_name)},meeting,members,isOwner,canChat,canDepart:trip.status==="OPEN"&&Date.now()>=Date.parse(trip.departure_start)&&Date.now()<Date.parse(trip.departure_end),verified:p.verification_status==="verified"}; });
}
async function notice(c:PoolClient,id:string,title:string,body:string,recipients?:string[]){
 await c.query(`insert into notifications(recipient_id,category,title,body,href)
 select user_id,'system',$2,$3,'/carpool/'||$1::text from carpool_members where trip_id=$1::uuid
 and (case when $4::uuid[] is null then status in ('APPROVED','PENDING','PAYMENT_PENDING') else user_id=any($4) end)`,[id,title,body,recipients||null]);
}
async function autoCompleteDueTrips(c?: PoolClient) {
 const sql = `with done as (
  update carpool_trips t set status='COMPLETED', version=version+1, updated_at=clock_timestamp()
  where t.status='OPEN' and t.departure_end < now()-interval '2 hours'
    and exists(select 1 from carpool_members m where m.trip_id=t.id and m.status='APPROVED')
  returning t.id
 ) insert into notifications(recipient_id,category,title,body,href)
 select m.user_id,'system','拼车行程已自动结束','出发窗口结束超过 2 小时，行程已自动结束；如实际未成行，请通过客服入口提交申诉。','/carpool/'||m.trip_id::text
 from carpool_members m join done d on d.id=m.trip_id
 where m.status in ('APPROVED','PAYMENT_PENDING')`;
 if (c) await c.query(sql);
 else await query(sql);
}
interface LockedTrip {id:string;owner_id:string;campus_id:string;capacity:number;gender_preference:GenderPreference;status:string;version:number;departure_start:Date;departure_end:Date;meeting:string}
async function lockTrip(c:PoolClient,p:Profile,id:string){
 const t=(await c.query<LockedTrip>("select * from carpool_trips where id=$1 and campus_id=$2 for update",[id,p.campus_id])).rows[0];
 if(!t)throw new CarpoolError("行程不存在或无权操作",404);return t;
}
function recruiting(t:LockedTrip){if(t.status!=="OPEN"||new Date(t.departure_end).getTime()<=Date.now())throw new CarpoolError("行程已出发、取消或过期，不能继续报名确认",409);}
async function occupied(c:PoolClient,id:string){return (await c.query<{count:number}>("select coalesce(sum(party_size),0)::int as count from carpool_members where trip_id=$1 and status='APPROVED'",[id])).rows[0].count;}
export async function mutateCarpool(p:Profile,input:CarpoolMutation){
 active(p);
 if(input.action==="create"||input.action==="apply"||input.action==="pay")verified(p);
 return transaction(async c=>{
  await autoCompleteDueTrips(c);
  if(input.action==="place"){
   if(p.role!=="admin"||!p.campus_id)throw new CarpoolError("仅本校管理员可以配置地点",403);
   if(input.id){const r=await c.query("update carpool_places set name=$1,active=$2 where id=$3 and campus_id=$4 returning id",[input.name,input.active,input.id,p.campus_id]);if(!r.rowCount)throw new CarpoolError("地点不存在",404);}
   else await c.query("insert into carpool_places(campus_id,name,active) values($1,$2,$3) on conflict(campus_id,name) do update set active=excluded.active",[p.campus_id,input.name,input.active]);
   return {ok:true};
  }
  if(input.action==="create"){
   await c.query("select id from profiles where id=$1 for update",[p.id]);
   const existing=(await c.query<{id:string}>("select id from carpool_trips where owner_id=$1 and client_id=$2",[p.id,input.clientId])).rows[0];if(existing)return existing;
   const preference=input.genderPreference||"ANY";
   if(preference!=="ANY"&&!input.genderConfirmed)throw new CarpoolError("请确认本人及已有同行均符合性别要求");
   const start=Date.parse(input.start),end=Date.parse(input.end);
   if(start<=Date.now()||end<=start||end-start>6*3600000||start>Date.now()+30*86400000)throw new CarpoolError("请选择未来30天内的出发时间，时间范围最长6小时");
   if(input.partySize>=input.capacity)throw new CarpoolError("计划总人数须大于已有同行人数");

   const recent=await c.query<{count:number}>("select count(*)::int as count from carpool_trips where owner_id=$1 and created_at>now()-interval '1 hour'",[p.id]);if(recent.rows[0].count>=5)throw new CarpoolError("发布较频繁，请稍后重试",429);
   const cancelled=await c.query<{count:number}>("select count(*)::int as count from carpool_trips where owner_id=$1 and status='CANCELLED' and updated_at>now()-interval '7 days'",[p.id]);if(cancelled.rows[0].count>=3)throw new CarpoolError("近期取消拼车次数较多，暂时不能继续发起行程，请联系平台客服",429);
   // Resolve names in a stable order to avoid deadlocks for reversed routes.
   const names=[...new Set([input.originName?.trim(),input.destinationName?.trim()].filter((v):v is string=>Boolean(v)))].sort();
   const resolved=new Map<string,string>();
   for(const name of names){
    if(name.length<2||name.length>80)throw new CarpoolError("地点名称须为2～80个字符");
    await c.query("insert into carpool_places(campus_id,name) values($1,$2) on conflict(campus_id,name) do nothing",[p.campus_id,name]);
    const place=(await c.query<{id:string;active:boolean}>("select id,active from carpool_places where campus_id=$1 and name=$2 for share",[p.campus_id,name])).rows[0];
    if(!place?.active)throw new CarpoolError("该地点已停用，请选择其他地点");
    resolved.set(name,place.id);
   }
   const originId=input.originName?resolved.get(input.originName.trim()):input.originId;
   const destinationId=input.destinationName?resolved.get(input.destinationName.trim()):input.destinationId;
   if(!originId||!destinationId)throw new CarpoolError("请填写出发地与目的地");
   if(originId===destinationId)throw new CarpoolError("出发地与目的地不能相同");
   const places=await c.query("select id from carpool_places where id=any($1::uuid[]) and campus_id=$2 and active",[[originId,destinationId],p.campus_id]);if(places.rowCount!==2)throw new CarpoolError("请选择本校已启用的地点");
   const t=(await c.query<{id:string}>(`insert into carpool_trips(owner_id,campus_id,origin_id,destination_id,departure_start,departure_end,capacity,luggage,meeting,client_id,gender_preference)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,[p.id,p.campus_id,originId,destinationId,input.start,input.end,input.capacity,input.luggage,input.meeting,input.clientId,preference])).rows[0];
   await c.query("insert into carpool_members(trip_id,user_id,party_size,status,gender_confirmed) values($1,$2,$3,'APPROVED',$4)",[t.id,p.id,input.partySize,preference!=="ANY"&&Boolean(input.genderConfirmed)]);return t;
  }
  const t=await lockTrip(c,p,input.id);
  const member=(await c.query<{status:string;party_size:number;joined_after:string;paid_at:string|null}>("select status,party_size,joined_after::text,paid_at::text from carpool_members where trip_id=$1 and user_id=$2",[t.id,p.id])).rows[0];
  if(input.action==="apply"){
   recruiting(t);if(member)throw new CarpoolError("你已申请过该行程，请查看我的拼车",409);
   if(t.gender_preference!=="ANY"&&!input.genderConfirmed)throw new CarpoolError(`该行程${GENDER_PREFERENCE[t.gender_preference]}，请确认本人及全部同行均符合要求`);
   if(input.partySize>t.capacity-await occupied(c,t.id))throw new CarpoolError("剩余人数不足",409);
   await c.query("insert into carpool_members(trip_id,user_id,party_size,status,gender_confirmed) values($1,$2,$3,'PENDING',$4)",[t.id,p.id,input.partySize,t.gender_preference!=="ANY"&&Boolean(input.genderConfirmed)]);
   await notice(c,t.id,"收到拼车申请","有同学申请加入，请确认同行人数。",[t.owner_id]);return {ok:true};
  }
  if(input.action==="respond"){
   if(t.owner_id!==p.id)throw new CarpoolError("仅发起人可处理申请",403);recruiting(t);
   const applicant=(await c.query<{party_size:number;status:string;verification_status:string;account_status:string;gender_confirmed:boolean}>(`select m.party_size,m.status,m.gender_confirmed,p.verification_status,p.status as account_status from carpool_members m join profiles p on p.id=m.user_id where m.trip_id=$1 and m.user_id=$2`,[t.id,input.userId])).rows[0];
   if(!applicant||applicant.status!=="PENDING")throw new CarpoolError("申请已处理或已撤回",409);
   if(input.accept){if(t.gender_preference!=="ANY"&&!applicant.gender_confirmed)throw new CarpoolError("申请人尚未确认同行性别要求",409);if(applicant.verification_status!=="verified"||applicant.account_status!=="active")throw new CarpoolError("申请人账号或认证状态已变化",409);if(applicant.party_size>t.capacity-await occupied(c,t.id))throw new CarpoolError("剩余人数不足，请刷新查看",409);}
   await c.query(`update carpool_members set status=$1,service_fee_cents=case when $1='PAYMENT_PENDING' then $4 else service_fee_cents end where trip_id=$2 and user_id=$3`,[input.accept?"PAYMENT_PENDING":"REJECTED",t.id,input.userId,CARPOOL_SERVICE_FEE_CENTS]);
   await notice(c,t.id,input.accept?"拼车申请已通过，待支付服务费":"拼车申请未通过",input.accept?"发起人已确认你的申请。请支付平台基础软件服务费后正式占位并进入群聊。":"可在拼车大厅寻找其他同行。",[input.userId]);
  }else if(input.action==="pay"){
   recruiting(t);
   if(t.owner_id===p.id)throw new CarpoolError("发起人已在行程中，无需支付加入服务费");
   if(!member||member.status!=="PAYMENT_PENDING")throw new CarpoolError("当前没有待支付的拼车资格",409);
   if(member.party_size>t.capacity-await occupied(c,t.id))throw new CarpoolError("名额已满，本次待支付资格已失效，请联系客服或选择其他行程",409);
   await c.query(`update carpool_members set status='APPROVED',paid_at=now(),joined_after=(select coalesce(max(id),0) from carpool_messages where trip_id=$1),read_through=(select coalesce(max(id),0) from carpool_messages where trip_id=$1) where trip_id=$1 and user_id=$2`,[t.id,p.id]);
   await notice(c,t.id,"拼车成员更新","新的同行成员已支付服务费并正式加入，请查看人数变化。");
   await notice(c,t.id,"已正式加入拼车","你已正式占位，可进入成员群聊沟通。退出或未成行请通过客服按规则处理。",[p.id]);
  }else if(input.action==="leave"){
   if(t.owner_id===p.id)throw new CarpoolError("发起人请使用取消行程");
   if(!member||!["PENDING","PAYMENT_PENDING","APPROVED"].includes(member.status))throw new CarpoolError("当前未参与此行程",409);
   if(t.status!=="OPEN")throw new CarpoolError("行程已出发或结束，请通过客服处理",409);
   await c.query("update carpool_members set status='LEFT' where trip_id=$1 and user_id=$2",[t.id,p.id]);
   await notice(c,t.id,"成员退出拼车","有同学退出或撤回申请，人数已更新；已支付服务费的退出按平台规则处理。");await notice(c,t.id,"已退出拼车","你已退出该行程，群聊访问已关闭。已支付服务费如需退款请在申诉期内联系客服处理。",[p.id]);
  }else if(input.action==="state"||input.action==="meeting"){
   if(t.owner_id!==p.id)throw new CarpoolError("仅发起人可修改行程",403);
   if(t.version!==input.version)throw new CarpoolError("行程已更新，请刷新重试",409);
   if(input.action==="meeting"){
    recruiting(t);await c.query("update carpool_trips set meeting=$1 where id=$2",[input.meeting,t.id]);await notice(c,t.id,"集合说明已更新","发起人更新了集合说明，请确认最新信息。");
   }else{
    const allowed=input.state==="DEPARTED"?t.status==="OPEN"&&Date.now()>=new Date(t.departure_start).getTime()&&Date.now()<=new Date(t.departure_end).getTime():input.state==="COMPLETED"?t.status==="DEPARTED"||Date.now()>new Date(t.departure_end).getTime()+2*3600000:t.status==="OPEN";
    if(!allowed)throw new CarpoolError("当前状态或时间不允许此操作",409);
    await c.query("update carpool_trips set status=$1 where id=$2",[input.state,t.id]);
    await notice(c,t.id,"拼车行程状态更新",input.state==="DEPARTED"?"行程已出发。":input.state==="COMPLETED"?"行程已结束，服务费将按规则结算。":"发起人已取消行程，已支付成员如需退款请通过客服审核处理。");
   }
  }else if(input.action==="send"||input.action==="read"){
   if(member?.status!=="APPROVED")throw new CarpoolError("仅当前确认成员可访问群聊",403);
   if(input.action==="read"){
    await c.query(`update carpool_members set read_through=greatest(read_through,$3::bigint) where trip_id=$1 and user_id=$2 and exists(select 1 from carpool_messages where trip_id=$1 and id=$3::bigint and id>carpool_members.joined_after)`,[t.id,p.id,input.through]);return {ok:true};
   }
   const duplicate=await c.query("select id from carpool_messages where trip_id=$1 and sender_id=$2 and client_id=$3",[t.id,p.id,input.clientId]);if(duplicate.rowCount)return {ok:true};
   if(!["OPEN","DEPARTED"].includes(t.status)||(t.status==="OPEN"&&new Date(t.departure_end).getTime()<=Date.now()))throw new CarpoolError("行程已结束、取消或过期，群聊只读",409);
   const count=await c.query<{count:number}>("select count(*)::int as count from carpool_messages where trip_id=$1 and sender_id=$2 and created_at>now()-interval '1 minute'",[t.id,p.id]);if(count.rows[0].count>=20)throw new CarpoolError("发送较频繁，请稍后再试",429);
   await c.query("insert into carpool_messages(trip_id,sender_id,body,client_id) values($1,$2,$3,$4) on conflict(sender_id,client_id) do nothing",[t.id,p.id,input.body,input.clientId]);return {ok:true};
  }
  await c.query("update carpool_trips set version=version+1,updated_at=clock_timestamp() where id=$1",[t.id]);return {ok:true};
 });
}
export async function carpoolChat(p:Profile,id:string,before?:string,after?:string){
 active(p);
 return transaction(async c=>{
  await autoCompleteDueTrips(c);
  const t=await lockTrip(c,p,id);
  const m=(await c.query<{joined_after:string}>("select joined_after::text from carpool_members where trip_id=$1 and user_id=$2 and status='APPROVED'",[id,p.id])).rows[0];
  if(!m)throw new CarpoolError("仅当前确认成员可访问群聊",403);
  const rows=(await c.query<CarpoolMessage>(`select m.id::text,m.sender_id,p.display_name as name,m.body,m.created_at from carpool_messages m join profiles p on p.id=m.sender_id
    where m.trip_id=$1 and m.id>$2::bigint and ($3::bigint is null or m.id<$3) and ($4::bigint is null or m.id>$4)
    order by m.id ${after?"asc":"desc"} limit 41`,[id,m.joined_after,before||null,after||null])).rows;
  const page=rows.slice(0,40).map(row=>({...row,name:maskCarpoolName(row.name)}));
  return {messages:after?page:page.reverse(),hasMore:rows.length>40,userId:p.id,readOnly:!["OPEN","DEPARTED"].includes(t.status)||(t.status==="OPEN"&&new Date(t.departure_end).getTime()<=Date.now())};
 });
}
