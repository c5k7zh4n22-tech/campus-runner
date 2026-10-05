"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Headphones, Plus, RefreshCw, Send } from "lucide-react";
import { SUPPORT_CATEGORIES, SUPPORT_STATUSES, canChangeSupportStatus, type SupportDetail, type SupportEntry, type SupportStatus, type SupportTicket } from "@/lib/support";
import { LoadingMessages, MessageFailure, RequestError, useMessagePolling, updateUnread } from "@/components/messages/shared";
import { SupportScreenshots, SupportEvidence, type PreparedScreenshot } from "./SupportScreenshots";

async function request<T>(url = "",body?: unknown,signal?: AbortSignal, screenshots: PreparedScreenshot[] = []): Promise<T> {
  let form: FormData | undefined;
  if (screenshots.length) {
    form = new FormData(); form.set("payload", JSON.stringify(body));
    screenshots.forEach(image => form!.append("screenshots", image.file));
  }
  const response=await fetch(`/api/support${url}`,{method:body ? "POST":"GET",cache:"no-store",signal,
    headers:body && !form ? {"Content-Type":"application/json"}:undefined,body:form || (body ? JSON.stringify(body):undefined)});
  const result=await response.json().catch(() => ({ error: response.status === 413 ? "上传内容过大，请减少截图后重试" : "服务暂时不可用，请重试" }));
  if (!response.ok) throw new RequestError(result.error || "操作失败，请重试",response.status);
  return result;
}
function time(value: string) { return new Date(value).toLocaleString("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}); }
function Badge({status}:{status:SupportStatus}) {
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${status === "RESOLVED" ? "bg-emerald-50 text-emerald-700" : status === "CLOSED" ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-blue-700"}`}>{SUPPORT_STATUSES[status]}</span>;
}

export function SupportHome({admin=false}:{admin?:boolean}) {
  const [status,setStatus]=useState("");
  const [page,setPage]=useState(0);
  const loader=useCallback(async(signal:AbortSignal)=>({ ...await request<{tickets:SupportTicket[];hasMore:boolean}>(`?admin=${admin}&page=${page}${status ? `&status=${status}`:""}`,undefined,signal),key:`${page}:${status}` }),[admin,page,status]);
  const {data,error,busy,refresh}=useMessagePolling(loader,true,30000);
  const current=data?.key === `${page}:${status}` ? data:undefined;
  return <div className="mx-auto max-w-3xl px-4 py-5 sm:py-8">
    <header className="mb-6 flex items-center justify-between gap-3"><div><h1 className="text-2xl font-black">{admin ? "客服工作台":"客服与售后"}</h1><p className="mt-2 text-xs leading-6 text-slate-500">{admin ? "受理问题、跟进回复与处理结果":"遇到问题，提交工单让我们帮你处理。"}</p></div><Headphones className="size-8 shrink-0 text-blue-600" /></header>
    {!admin && <>
      <Link href="/support/new" className="mb-6 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-blue-600 font-bold text-white shadow-lg shadow-blue-600/15"><Plus className="size-5" />提交售后问题</Link>
      <section aria-label="常见问题" className="card mb-6 p-4"><h2 className="mb-2 text-sm font-bold">常见问题</h2>{[
        ["跑腿没送到，应该怎么办？","先在订单详情联系对方。沟通后仍未解决，可关联该订单提交售后，并写明发生时间和期望处理方式。"],
        ["退款申请提交后会自动退款吗？","不会。客服会先核实问题，并在工单中说明处理结果。工单显示已解决不代表退款到账，实际付款情况以支付记录为准。"],
        ["账号或认证遇到问题怎么办？","选择“账号与认证”说明错误提示及操作步骤。请勿提交登录密码、验证码、银行卡号等敏感信息。"]
      ].map(([title,body])=><details key={title} className="border-t border-slate-100 py-3"><summary className="min-h-8 cursor-pointer text-sm font-semibold text-slate-700">{title}</summary><p className="mt-2 text-sm leading-7 text-slate-500">{body}</p></details>)}</section>
    </>}
    <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-bold">{admin ? "售后工单":"我的工单"}</h2><button onClick={refresh} aria-label="刷新工单" className="grid size-11 place-items-center rounded-xl bg-white text-blue-600"><RefreshCw className="size-4" /></button></div>
    <label className="label mb-4">处理状态<select className="field" value={status} onChange={event=>{setStatus(event.target.value);setPage(0);}}><option value="">全部状态</option>{Object.entries(SUPPORT_STATUSES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    {error && <MessageFailure error={error} retry={refresh} />}
    {!current && !error && <LoadingMessages />}
    <section aria-label="工单列表" className="space-y-3">
      {current?.tickets.map(ticket=><Link key={ticket.id} href={`/support/${ticket.id}`} className="card block p-4 hover:border-blue-300"><div className="flex items-start justify-between gap-3"><h3 className="min-w-0 break-words font-bold">{ticket.subject}</h3><Badge status={ticket.status} /></div><p className="mt-2 text-xs text-slate-500">{SUPPORT_CATEGORIES[ticket.category]}{admin ? ` · ${ticket.owner_name}`:""}</p><div className="mt-3 flex flex-wrap justify-between gap-2 text-[11px] text-slate-400"><span>更新于 {time(ticket.updated_at)}</span><span>{ticket.agent_name ? `客服：${ticket.agent_name}`:"等待客服受理"}</span></div></Link>)}
      {current && !current.tickets.length && <div className="card px-5 py-12 text-center text-sm text-slate-500">{status ? "暂无该状态的工单":"还没有售后工单"}</div>}
    </section>
    <div className="mt-4 flex items-center justify-between text-sm"><button disabled={!page || busy} onClick={()=>setPage(p=>p-1)} className="min-h-11 rounded-xl px-4 text-blue-700 disabled:opacity-30">上一页</button><span className="text-xs text-slate-400">第 {page+1} 页</span><button disabled={!current?.hasMore || busy} onClick={()=>setPage(p=>p+1)} className="min-h-11 rounded-xl px-4 text-blue-700 disabled:opacity-30">下一页</button></div>
  </div>;
}

export function SupportCreate({orderId,tripId}:{orderId?:string;tripId?:string}) {
  const [screenshots, setScreenshots] = useState<PreparedScreenshot[]>([]);
  const [imageBusy, setImageBusy] = useState(false);
  const router=useRouter();
  const [category,setCategory]=useState<keyof typeof SUPPORT_CATEGORIES>(tripId ? "carpool":orderId ? "order":"account");
  const [selected,setSelected]=useState(orderId || "");
  const [page,setPage]=useState(0);
  const [busy,setBusy]=useState(false);
  const [failure,setFailure]=useState<Error>();
  const key=useRef<{fingerprint:string;id:string} | null>(null);
  const loader=useCallback((signal:AbortSignal)=>request<{orders:Array<{id:string;description:string}>;hasMore:boolean}>(`?view=orders&page=${page}`,undefined,signal),[page]);
  const {data,error,refresh}=useMessagePolling(loader,!tripId,60000);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || imageBusy) return;
    const values=new FormData(event.currentTarget);
    const payload={action:"create",category,subject:values.get("subject"),body:values.get("body"),orderId:tripId ? undefined:selected || undefined,tripId};
    const fingerprint=JSON.stringify([payload, screenshots.map(image => image.id)]);
    if (key.current?.fingerprint!==fingerprint) key.current={fingerprint,id:crypto.randomUUID()};
    setBusy(true);setFailure(undefined);
    try { const result=await request<{id:string}>("",{...payload,clientId:key.current.id},undefined,screenshots); router.push(`/support/${result.id}`); }
    catch(cause){setFailure(cause as Error);setBusy(false);}
  }
  return <div className="mx-auto max-w-2xl px-4 py-5"><Link href="/support" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-slate-500"><ArrowLeft className="size-4" />返回客服中心</Link><h1 className="mb-5 text-2xl font-black">提交售后问题</h1>
    <form onSubmit={submit} className="card grid gap-5 p-5">
      <label className="label">问题类型<select disabled={Boolean(tripId)} className="field" value={category} onChange={event=>setCategory(event.target.value as keyof typeof SUPPORT_CATEGORIES)}>{Object.entries(SUPPORT_CATEGORIES).filter(([value])=>value!=="carpool"||Boolean(tripId)).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      {tripId ? <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-700">已关联拼车行程 <Link href={`/carpool/${tripId}`}>查看行程 →</Link></p> : <label className="label">关联跑腿订单{["order","refund"].includes(category) ? "（必选）":"（选填）"}<select className="field" required={["order","refund"].includes(category)} value={selected} onChange={event=>setSelected(event.target.value)}><option value="">请选择本人发布或接取的订单</option>{selected && !data?.orders.some(order=>order.id===selected) && <option value={selected}>已选择订单 · {selected.slice(0,8)}</option>}{data?.orders.map(order=><option key={order.id} value={order.id}>{order.description.slice(0,45)} · {order.id.slice(0,8)}</option>)}</select></label>}
      {!tripId && <div className="flex justify-between text-xs"><button type="button" disabled={!page} onClick={()=>setPage(p=>p-1)} className="min-h-11 text-blue-700 disabled:opacity-30">较新订单</button><button type="button" disabled={!data?.hasMore} onClick={()=>setPage(p=>p+1)} className="min-h-11 text-blue-700 disabled:opacity-30">更早订单</button></div>}
      {error && <MessageFailure error={error} retry={refresh} />}
      <label className="label">问题标题<input className="field" name="subject" placeholder="用一句话描述遇到的问题" required minLength={2} maxLength={80} /></label>
      <label className="label">详细说明<textarea className="field" name="body" rows={6} required minLength={5} maxLength={4000} placeholder="请说明发生时间、具体情况及期望处理方式。不要填写密码或验证码。" /></label>
      <SupportScreenshots value={screenshots} onChange={setScreenshots} disabled={busy} onBusy={setImageBusy} />
      {category === "refund" && <p className="rounded-xl bg-blue-50 p-3 text-xs leading-6 text-blue-700">提交后由客服核实处理，不会自动发起退款，也不会改变当前订单状态。</p>}
      {failure && <p role="alert" className="text-sm text-red-600">{failure.message}</p>}
      <button disabled={busy || imageBusy} className="min-h-12 rounded-xl bg-blue-600 font-bold text-white disabled:opacity-40">{busy ? "正在提交…":"提交申请"}</button>
    </form>
  </div>;
}

export function SupportConversation({id}:{id:string}) {
  const [screenshots, setScreenshots] = useState<PreparedScreenshot[]>([]);
  const [imageBusy, setImageBusy] = useState(false);
  const loader=useCallback((signal:AbortSignal)=>request<SupportDetail>(`?view=detail&id=${id}`,undefined,signal),[id]);
  const {data,error,refresh}=useMessagePolling(loader,true,15000);
  const [history,setHistory]=useState<SupportEntry[]>([]);
  const [more,setMore]=useState<boolean>();
  const [olderBusy,setOlderBusy]=useState(false);
  const [body,setBody]=useState("");
  const [next,setNext]=useState("");
  const [reason,setReason]=useState("");
  const [busy,setBusy]=useState(false);
  const [failure,setFailure]=useState<Error>();
  const mutationKey=useRef<{fingerprint:string;id:string}|null>(null);
  const entries=[...new Map([...history,...(data?.entries || [])].map(entry=>[entry.id,entry])).values()].sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1);
  const admin=Boolean(data?.isAdmin && !data?.isOwner);
  async function mutate(payload:Record<string,unknown>) {
    if (busy || imageBusy) return;
    const images = payload.action === "reply" ? screenshots : [];
    const fingerprint=JSON.stringify([payload, images.map(image => image.id)]);
    if (mutationKey.current?.fingerprint!==fingerprint) mutationKey.current={fingerprint,id:crypto.randomUUID()};
    setBusy(true);setFailure(undefined);
    try { await request("",{...payload,id,clientId:mutationKey.current.id},undefined,images); if (payload.action === "reply") { setBody(""); setScreenshots([]); } setReason("");setNext("");mutationKey.current=null;refresh();updateUnread(); }
    catch(cause){setFailure(cause as Error);refresh();}
    finally{setBusy(false);}
  }
  async function older() {
    if (!entries[0]) return;
    setOlderBusy(true);setFailure(undefined);
    try {const result=await request<SupportDetail>(`?view=detail&id=${id}&before=${entries[0].id}`);setHistory(value=>[...result.entries,...value]);setMore(result.hasMore);}
    catch(cause){setFailure(cause as Error);}
    finally{setOlderBusy(false);}
  }
  return <div className="mx-auto max-w-3xl px-4 py-5"><div className="mb-4 flex justify-between"><Link href={data?.isAdmin ? "/admin/support":"/support"} className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-500"><ArrowLeft className="size-4" />返回工单列表</Link><button onClick={refresh} className="grid size-11 place-items-center text-blue-600" aria-label="刷新处理进度"><RefreshCw className="size-4" /></button></div>
    {error && <MessageFailure error={error} retry={refresh} />}
    {!data && !error && <LoadingMessages />}
    {data && <>
      <header className="card p-5"><div className="flex items-start justify-between gap-3"><h1 className="min-w-0 break-words text-xl font-black">{data.ticket.subject}</h1><Badge status={data.ticket.status} /></div><p className="mt-3 text-xs text-slate-500">{SUPPORT_CATEGORIES[data.ticket.category]} · 提交于 {time(data.ticket.created_at)}</p><p className="mt-2 text-xs text-slate-500">{admin ? `申请人：${data.ticket.owner_name} · `:""}{data.ticket.agent_name ? `处理客服：${data.ticket.agent_name}`:"等待客服受理"}</p><p className="mt-2 break-all text-[10px] text-slate-400">工单编号：{id}</p>{data.ticket.order_id && <Link className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-blue-700" href={`/orders/${data.ticket.order_id}`}>查看关联订单 →</Link>}{data.ticket.trip_id && <Link className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-blue-700" href={`/carpool/${data.ticket.trip_id}`}>查看关联拼车行程 →</Link>}{data.ticket.category === "refund" && <p className="mt-2 text-xs leading-6 text-slate-500">本工单记录售后处理进度，实际退款请以支付记录为准。</p>}</header>
      <section aria-label="处理记录" className="my-5 space-y-3">
        {(more ?? data.hasMore) && <button disabled={olderBusy} onClick={older} className="min-h-11 w-full text-sm text-blue-700">{olderBusy ? "加载中…":"查看更早记录"}</button>}
        {entries.map(entry=><article key={entry.id} className={`rounded-2xl border p-4 ${entry.kind === "status" ? "border-blue-100 bg-blue-50/60":entry.actor_role === "admin" ? "border-blue-100 bg-white":"border-slate-200 bg-white"}`}><div className="flex items-center justify-between gap-2 text-xs"><strong className={entry.actor_role === "admin" ? "text-blue-700":"text-slate-700"}>{entry.actor_role === "admin" ? "平台客服":"申请人"}{entry.kind === "status" ? " · 处理记录":""}</strong><time className="text-slate-400">{time(entry.created_at)}</time></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{entry.body}</p><SupportEvidence images={entry.attachments} /></article>)}
      </section>
      {failure && <MessageFailure error={failure} retry={()=>{setFailure(undefined);refresh();}} />}
      {!["RESOLVED","CLOSED"].includes(data.ticket.status) && <form onSubmit={event=>{event.preventDefault();void mutate({action:"reply",body});}} className="card grid gap-3 p-4"><label className="label">{admin ? "回复用户":"补充说明"}<textarea className="field" rows={4} maxLength={4000} required value={body} onChange={event=>setBody(event.target.value)} placeholder={admin ? "请提供明确的处理建议或需要补充的信息":"补充问题情况，便于客服跟进"} /></label><SupportScreenshots value={screenshots} onChange={setScreenshots} disabled={busy} onBusy={setImageBusy} /><button disabled={busy || imageBusy || !body.trim()} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold text-white disabled:opacity-40"><Send className="size-4" />{busy ? "提交中…":"发送回复"}</button></form>}
      <form onSubmit={event=>{event.preventDefault();void mutate({action:"status",status:next,body:reason,version:data.ticket.version});}} className="card mt-4 grid gap-3 p-4"><h2 className="font-bold">{admin ? "处理工单":"工单操作"}</h2><label className="label">选择操作<select className="field" required value={next} onChange={event=>setNext(event.target.value)}><option value="">请选择</option>{Object.entries(SUPPORT_STATUSES).filter(([value])=>canChangeSupportStatus(data.ticket.status,value as SupportStatus,admin)).map(([value,label])=><option key={value} value={value}>{value === "OPEN" ? "重新打开":value === "CLOSED" && !admin ? "确认关闭 / 撤回":label}</option>)}</select></label><label className="label">{admin ? "处理结果或原因":"操作原因"}<textarea className="field" rows={3} required minLength={2} maxLength={4000} value={reason} onChange={event=>setReason(event.target.value)} placeholder="请说明原因，记录会保留在工单中" /></label><button disabled={busy || !next || reason.trim().length<2} className="min-h-12 rounded-xl border border-blue-200 text-sm font-bold text-blue-700 disabled:opacity-40">提交处理</button></form>
    </>}
  </div>;
}
