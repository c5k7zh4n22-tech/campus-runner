"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useState, type FormEvent } from "react";
import { Bell, CheckCheck, ClipboardList, Search } from "lucide-react";
import type { InboxData } from "@/lib/message-types";
import { Avatar, LoadingMessages, MessageFailure, NoMessages, UnreadBadge, messageRequest, messageTime, updateUnread, useMessagePolling } from "./shared";

export function MessageCenter() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [pages, setPages] = useState(1);
  const [marking, setMarking] = useState(false);
  const [actionError, setActionError] = useState<Error>();
  const [notice, setNotice] = useState("");
  const loader = useCallback(async (signal: AbortSignal) => {
    const results: InboxData[] = [];
    for (let page = 0; page < pages; page++) {
      const result = await messageRequest<InboxData>(`?search=${encodeURIComponent(search)}&offset=${page * 20}`, undefined, signal);
      results.push(result);
      if (!result.hasMore) break;
    }
    return { ...results[0], conversations: [...new Map(results.flatMap((result) => result.conversations).map((row) => [row.id, row])).values()], hasMore: results.at(-1)!.hasMore, search };
  }, [search, pages]);
  const { data, error, busy, refresh } = useMessagePolling(loader);
  const current = data?.search === search ? data : undefined;
  async function markAll() {
    setMarking(true); setActionError(undefined);
    try { await messageRequest("", { action: "read-all" }); updateUnread(); refresh(); setNotice("已将当前消息全部标为已读"); }
    catch (cause) { setActionError(cause as Error); }
    finally { setMarking(false); }
  }
  function submitSearch(event: FormEvent) { event.preventDefault(); setPages(1); setSearch(draft.trim()); }
  return <div className="mx-auto max-w-2xl px-4 py-5 sm:py-8">
    <header className="mb-5 flex items-center justify-between gap-3">
      <div><h1 className="text-2xl font-black tracking-tight">消息</h1><p className="mt-1 text-xs text-slate-400">校园里的每一份回应</p></div>
      <div className="flex items-center gap-1">
        <button aria-label="搜索会话" aria-expanded={searchOpen} onClick={() => setSearchOpen(!searchOpen)} className="grid size-11 place-items-center rounded-xl text-slate-600 hover:bg-white"><Search className="size-5" /></button>
        <button onClick={markAll} disabled={marking || !current || current.summary.total === 0} className="flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs font-bold text-blue-700 disabled:opacity-40"><CheckCheck className="size-4" />{marking ? "处理中" : "全部已读"}</button>
      </div>
    </header>
    {searchOpen && <form onSubmit={submitSearch} className="mb-4 flex gap-2"><input autoFocus className="field min-w-0 flex-1" aria-label="按昵称搜索会话" placeholder="搜索同学昵称" maxLength={80} value={draft} onChange={(event) => setDraft(event.target.value)} /><button className="rounded-xl bg-blue-600 px-4 text-sm font-bold text-white">搜索</button></form>}
    {search && <div className="mb-3 flex items-center justify-between gap-3 text-xs text-slate-500"><span className="truncate">搜索：{search}</span><button className="min-h-11 shrink-0 text-blue-700" onClick={() => { setDraft(""); setSearch(""); setPages(1); }}>清除搜索</button></div>}
    <Link href="/support" className="mb-4 flex min-h-12 items-center justify-between rounded-2xl border border-blue-100 bg-blue-50 px-4 text-sm font-bold text-blue-700">客服与售后<span aria-hidden>→</span></Link>
    <p role="status" className="sr-only">{notice}</p>
    {(error || actionError) && <MessageFailure error={(actionError || error)!} retry={() => { setActionError(undefined); refresh(); }} />}
    {!current && !error && <LoadingMessages />}
    {current && <>
      {current.summary.carpoolGroups?.length > 0 && <section aria-label="同路讨论" className="mb-4 overflow-hidden rounded-3xl border border-blue-100 bg-white"><div className="flex items-center justify-between px-4 py-3"><h2 className="text-sm font-bold">同路讨论</h2><Link href="/carpool/mine" className="text-xs text-blue-600">我的结伴 →</Link></div>{current.summary.carpoolGroups.map(group=><Link key={group.id} href={`/carpool/${group.id}/chat`} className="flex min-h-14 items-center justify-between gap-3 border-t border-slate-100 px-4 text-sm"><span className="truncate">{group.title}</span><span className="relative size-6 shrink-0"><UnreadBadge count={group.unread} /></span></Link>)}</section>}
      <section aria-label="通知分类" className="overflow-hidden rounded-3xl border border-slate-100 bg-white">
        {current.summary.categories.map((row) => {
          const order = row.category === "order";
          const Icon = order ? ClipboardList : Bell;
          return <Link key={row.category} href={`/messages/notifications/${row.category}`} className="flex min-h-24 items-center gap-3 border-b border-slate-100 px-4 py-4 last:border-0 hover:bg-blue-50/50">
            <span className={`relative grid size-12 shrink-0 place-items-center rounded-full ${order ? "bg-blue-600 text-white" : "bg-sky-100 text-sky-600"}`}><Icon className="size-6" /><UnreadBadge count={row.unread} /></span>
            <span className="min-w-0 flex-1"><strong className="block text-base">{order ? "订单消息" : "系统通知"}</strong><span className="mt-1 block truncate text-sm text-slate-400">{row.preview || (order ? "接单、配送、完成进度都在这里" : "认证结果与校园平台公告")}</span><span className="mt-1 block text-[11px] text-slate-400">{messageTime(row.created_at)}</span></span>
          </Link>;
        })}
      </section>
      <div className="mb-2 mt-6 flex items-center justify-between"><h2 className="text-sm font-bold text-slate-500">聊天会话</h2><span className="text-[10px] text-slate-400">自动更新</span></div>
      <section aria-label="聊天会话" aria-busy={busy} className="overflow-hidden rounded-3xl border border-slate-100 bg-white">
        {current.conversations.map((row) => <Link href={`/messages/${row.id}`} key={row.id} className="flex min-h-24 items-center gap-3 border-b border-slate-100 px-4 py-4 last:border-0 hover:bg-blue-50/50">
          <span className="relative shrink-0"><Avatar src={row.avatar_url} name={row.display_name} /><UnreadBadge count={row.unread} /></span>
          <span className="min-w-0 flex-1"><strong className="block truncate text-base">{row.display_name}</strong><span className="mt-1 block truncate text-sm text-slate-400">{row.preview || "开始聊聊吧"}</span><time className="mt-1 block text-[11px] text-slate-400" dateTime={row.updated_at}>{messageTime(row.updated_at)}</time></span>
          {row.image_url && <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-slate-100"><Image unoptimized src={row.image_url} alt={row.context_title} fill sizes="48px" className="object-cover" /></span>}
        </Link>)}
        {!current.conversations.length && <NoMessages title={search ? "没有找到该昵称的会话" : undefined} description={search ? "试试其他昵称，或清除搜索条件。" : undefined} />}
      </section>
      {current.hasMore && <button disabled={busy} onClick={() => setPages((value) => value + 1)} className="mt-3 min-h-12 w-full rounded-xl bg-white text-sm font-bold text-blue-700 disabled:opacity-50">{busy ? "加载中…" : "加载更多会话"}</button>}
    </>}
  </div>;
}
