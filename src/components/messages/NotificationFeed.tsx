"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { MessageCategory, NotificationRow } from "@/lib/message-types";
import { LoadingMessages, MessageFailure, NoMessages, ReadOnView, messageRequest, messageTime, useMessagePolling } from "./shared";

type Feed = { notifications: NotificationRow[]; hasMore: boolean };
export function NotificationFeed({ category }: { category: MessageCategory }) {
  const [pages, setPages] = useState(1);
  const loader = useCallback(async (signal: AbortSignal) => {
    let before = "";
    const rows: NotificationRow[] = [];
    let hasMore = false;
    for (let page = 0; page < pages; page++) {
      const result = await messageRequest<Feed>(`?view=notifications&category=${category}${before ? `&before=${before}` : ""}`, undefined, signal);
      rows.push(...result.notifications); hasMore = result.hasMore;
      before = result.notifications.at(-1)?.id || "";
      if (!hasMore) break;
    }
    return { notifications: rows, hasMore };
  }, [category, pages]);
  const { data, error, busy, refresh } = useMessagePolling(loader);
  return <div className="mx-auto max-w-2xl px-4 py-5">
    <header className="mb-5 flex items-center gap-3"><Link href="/messages" aria-label="返回消息中心" className="grid size-11 place-items-center rounded-xl bg-white"><ArrowLeft className="size-5" /></Link><h1 className="text-xl font-black">{category === "order" ? "订单消息" : "系统通知"}</h1></header>
    {error && <MessageFailure error={error} retry={refresh} />}
    {!data && !error && <LoadingMessages />}
    {data && !data.notifications.length && <NoMessages title="暂时没有通知" description="有新的进度或公告时，会在这里通知你。" />}
    <section aria-label="通知列表" className="space-y-3">
      {data?.notifications.map((row) => <ReadOnView key={row.id} payload={!row.read_at ? { action: "read-notifications", category, ids: [row.id] } : undefined}>
        <article className="rounded-2xl border border-slate-100 bg-white p-5"><div className="flex items-start gap-2"><h2 className="flex-1 text-sm font-bold">{row.title}</h2>{!row.read_at && <span aria-label="未读" className="mt-1 size-2 shrink-0 rounded-full bg-red-500" />}</div><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{row.body}</p><time dateTime={row.created_at} className="mt-3 block text-xs text-slate-400">{messageTime(row.created_at)}</time>{row.href && <Link href={row.href} className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-blue-700">查看详情 →</Link>}</article>
      </ReadOnView>)}
    </section>
    {data?.hasMore && <button onClick={() => setPages((value) => value + 1)} disabled={busy} className="mt-4 min-h-12 w-full rounded-xl bg-white text-sm font-bold text-blue-700 disabled:opacity-40">{busy ? "加载中…" : "加载更多通知"}</button>}
  </div>;
}
