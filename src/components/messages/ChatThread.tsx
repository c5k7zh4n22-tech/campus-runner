"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowDown, Send } from "lucide-react";
import type { ChatMessage, ThreadData } from "@/lib/message-types";
import { Avatar, LoadingMessages, MessageFailure, NoMessages, ReadOnView, messageRequest, messageTime, updateUnread, useMessagePolling } from "./shared";

export function ChatThread({ id }: { id: string }) {
  const cached = useRef<ThreadData | null>(null);
  const loader = useCallback(async (signal: AbortSignal) => {
    let result: ThreadData;
    if (!cached.current?.messages.length) {
      result = await messageRequest<ThreadData>(`?view=thread&id=${id}`, undefined, signal);
    } else {
      result = { ...cached.current, messages: [...cached.current.messages] };
      // Drain every new page after the last received ID, including after a tab
      // has been hidden for a long time; never drop a gap between snapshots.
      let more = true;
      while (more) {
        const page = await messageRequest<ThreadData>(`?view=thread&id=${id}&after=${result.messages.at(-1)!.id}`, undefined, signal);
        result.messages.push(...page.messages); result.conversation = page.conversation;
        more = page.hasMore;
      }
      const latest = await messageRequest<ThreadData>(`?view=thread&id=${id}`, undefined, signal);
      const receipts = new Map(latest.messages.map((message) => [message.id, message]));
      result.messages = result.messages.map((message) => receipts.get(message.id) || message);
    }
    if (!signal.aborted) cached.current = result;
    return result;
  }, [id]);
  const { data, error, refresh } = useMessagePolling(loader);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [historyMore, setHistoryMore] = useState<boolean>();
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState<Error>();
  const [newBelow, setNewBelow] = useState(false);
  const retryKey = useRef<{ body: string; clientId: string } | null>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const lastId = data?.messages.at(-1)?.id;
  useEffect(() => {
    if (!lastId || !scrollArea.current) return;
    if (atBottom.current) scrollArea.current.scrollTop = scrollArea.current.scrollHeight;
    else setNewBelow(true);
  }, [lastId]);
  const messages = [...new Map([...history, ...(data?.messages || [])].map((message) => [message.id, message])).values()]
    .sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1);
  async function older() {
    if (!messages[0]) return;
    setLoadingOlder(true); setActionError(undefined);
    const element = scrollArea.current;
    const height = element?.scrollHeight || 0;
    try {
      const result = await messageRequest<ThreadData>(`?view=thread&id=${id}&before=${messages[0].id}`);
      setHistory((value) => [...result.messages, ...value]); setHistoryMore(result.hasMore);
      requestAnimationFrame(() => { if (element) element.scrollTop += element.scrollHeight - height; });
    } catch (cause) { setActionError(cause as Error); }
    finally { setLoadingOlder(false); }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true); setActionError(undefined);
    if (retryKey.current?.body !== text) retryKey.current = { body: text, clientId: crypto.randomUUID() };
    try {
      await messageRequest("", { action: "send", id, body: text, clientId: retryKey.current.clientId });
      setHistory((value) => [...value, ...(data?.messages || [])]);
      setBody(""); retryKey.current = null; atBottom.current = true; refresh(); updateUnread();
    } catch (cause) { setActionError(cause as Error); }
    finally { setSending(false); }
  }
  return <div className="mx-auto max-w-2xl px-3 py-4 sm:px-4">
    <div className="chat-shell flex min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 p-3"><Link href="/messages" aria-label="返回消息中心" className="grid size-11 shrink-0 place-items-center rounded-xl text-slate-600"><ArrowLeft className="size-5" /></Link>
        {data && <Avatar src={data.conversation.avatar_url} name={data.conversation.display_name} />}
        <h1 className="min-w-0 truncate font-bold">{data?.conversation.display_name || "聊天"}</h1>
      </header>
      {data && <Link href={data.conversation.href} className="shrink-0 truncate border-b border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-700">关联{data.conversation.href.startsWith("/orders") ? "订单" : "闲置"} · {data.conversation.context_title}</Link>}
      {(error || actionError) && <MessageFailure error={(actionError || error)!} retry={() => { setActionError(undefined); refresh(); }} />}
      <div ref={scrollArea} role="log" aria-label="聊天记录" aria-live="polite" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-slate-50 p-4" onScroll={() => {
        const el = scrollArea.current!; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        if (atBottom.current) setNewBelow(false);
      }}>
        {!data && !error && <LoadingMessages />}
        {data && (historyMore ?? data.hasMore) && <button disabled={loadingOlder} onClick={older} className="min-h-11 w-full text-xs font-bold text-blue-700">{loadingOlder ? "加载中…" : "加载更早消息"}</button>}
        {data && !messages.length && <NoMessages title="和同学打个招呼吧" description="约定取送时间、确认商品细节，都可以在这里沟通。" />}
        {data && messages.map((message) => {
          const mine = message.sender_id === data.userId;
          return <ReadOnView key={message.id} payload={!mine && !message.read_at ? { action: "read", id, through: message.id } : undefined} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 ${mine ? "rounded-tr-sm bg-blue-600 text-white" : "rounded-tl-sm border border-slate-200 bg-white text-slate-800"}`}>{message.body}</div>
            <time className="mt-1 text-[10px] text-slate-400" dateTime={message.created_at}>{messageTime(message.created_at)}{mine && message.read_at ? " · 已读" : ""}</time>
          </ReadOnView>;
        })}
      </div>
      {newBelow && <button className="flex min-h-11 shrink-0 items-center justify-center gap-2 bg-blue-50 text-xs font-bold text-blue-700" onClick={() => { if (scrollArea.current) scrollArea.current.scrollTop = scrollArea.current.scrollHeight; setNewBelow(false); }}><ArrowDown className="size-4" />查看新消息</button>}
      <form onSubmit={send} className="flex shrink-0 items-end gap-2 border-t border-slate-100 bg-white p-3">
        <textarea aria-label="消息内容" rows={2} maxLength={2000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="发送消息…" className="field max-h-32 min-h-11 flex-1 resize-none" disabled={sending || !data} />
        <button aria-label="发送消息" disabled={sending || !body.trim() || !data} className="grid size-12 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white disabled:opacity-40"><Send className="size-5" /></button>
      </form>
    </div>
  </div>;
}
