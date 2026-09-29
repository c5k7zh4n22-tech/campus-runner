"use client";
import { useState, type FormEvent } from "react";
import { messageRequest } from "./shared";

export function AnnouncementForm() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    if (!window.confirm("将公告发送给所有正常状态的校园用户？")) return;
    setBusy(true); setStatus("");
    try {
      await messageRequest("", { action: "announce", title: values.get("title"), body: values.get("body") });
      setStatus("公告已发送，可在系统通知中查看。"); form.reset();
    } catch (error) { setStatus(error instanceof Error ? error.message : "发送失败，请重试"); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="card mt-6 grid max-w-2xl gap-5 p-5"><label className="label">公告标题<input className="field" name="title" required maxLength={80} /></label><label className="label">公告内容<textarea className="field" name="body" required maxLength={2000} rows={6} /></label><button disabled={busy} className="min-h-12 rounded-xl bg-blue-600 text-sm font-bold text-white disabled:opacity-50">{busy ? "发送中…" : "发布给所有用户"}</button><p role="status" className="text-sm text-slate-600">{status}</p></form>;
}
