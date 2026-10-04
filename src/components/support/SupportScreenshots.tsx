"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { MAX_SUPPORT_IMAGES, MAX_SUPPORT_IMAGE_BYTES, SUPPORT_IMAGE_TYPES, type SupportAttachment } from "@/lib/support-attachments";

export interface PreparedScreenshot { id: string; file: File; preview: string }
async function prepare(file: File): Promise<PreparedScreenshot> {
  if (!SUPPORT_IMAGE_TYPES.includes(file.type)) throw new Error("请选择 JPG、PNG 或 WebP 截图");
  if (file.size > 5 * 1024 * 1024 || !file.size) throw new Error("每张原图须大于 0 且不超过 5MB");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 20_000_000) throw new Error("图片尺寸过大，请裁剪后上传");
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器无法处理截图，请换用其他浏览器");
    context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob: Blob | null = null;
    for (const quality of [0.88, 0.75, 0.6]) {
      blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", quality));
      if (blob && blob.size <= MAX_SUPPORT_IMAGE_BYTES) break;
    }
    if (!blob || blob.size > MAX_SUPPORT_IMAGE_BYTES) throw new Error("截图压缩后仍过大，请裁剪或分开截图");
    const preview = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("截图读取失败")); reader.readAsDataURL(blob!);
    });
    return { id: crypto.randomUUID(), file: new File([blob], "screenshot", { type: blob.type }), preview };
  } finally { bitmap.close(); }
}

export function SupportScreenshots({ value, onChange, disabled, onBusy }: {
  value: PreparedScreenshot[]; onChange: (value: PreparedScreenshot[]) => void; disabled: boolean; onBusy: (busy: boolean) => void;
}) {
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const previewDialog = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<string>();
  const lock = useRef(false);
  async function select(files: File[]) {
    if (lock.current || disabled || !files.length) return;
    setError("");
    if (value.length + files.length > MAX_SUPPORT_IMAGES) { setError("每次最多添加 3 张截图，请减少选择数量"); return; }
    lock.current = true; setProcessing(true); onBusy(true);
    try {
      const added: PreparedScreenshot[] = [];
      for (const file of files) added.push(await prepare(file));
      onChange([...value, ...added]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "截图处理失败，请重新选择"); }
    finally { lock.current = false; setProcessing(false); onBusy(false); }
  }
  return <div className="grid gap-3">
    <div className="flex items-center justify-between"><span className="text-sm font-bold text-slate-700">截图证明（选填）</span><span className="text-xs text-slate-400">{value.length} / 3</span></div>
    <p className="text-xs leading-5 text-slate-500">支持 JPG、PNG、WebP，原图每张不超过 5MB，将自动压缩。仅申请人和客服可查看，请先遮挡无关隐私。</p>
    <input ref={input} aria-label="选择截图证明" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled || processing || value.length >= MAX_SUPPORT_IMAGES} className="sr-only" onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ""; void select(files); }} />
    <div className="grid grid-cols-3 gap-2">{value.map((item, index) => <div key={item.id} className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <button type="button" onClick={() => { setPreview(item.preview); previewDialog.current?.showModal(); }} aria-label={`预览已选截图 ${index + 1}`} className="relative block aspect-square w-full"><Image unoptimized src={item.preview} alt={`已选截图 ${index + 1}`} fill sizes="160px" className="object-contain" /></button>
      <button type="button" aria-label={`移除截图 ${index + 1}`} disabled={disabled || processing} onClick={() => onChange(value.filter(image => image.id !== item.id))} className="absolute right-0 top-0 grid size-11 place-items-center rounded-bl-xl bg-white/90 text-slate-700 disabled:opacity-40"><X className="size-4" /></button>
    </div>)}</div>
    <button type="button" onClick={() => input.current?.click()} disabled={disabled || processing || value.length >= MAX_SUPPORT_IMAGES} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 text-sm font-bold text-blue-700 disabled:opacity-40"><ImagePlus className="size-5" />{processing ? "正在处理截图…" : "添加截图"}</button>
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    <dialog ref={previewDialog} aria-label="截图预览" className="fixed inset-0 m-auto max-h-[90dvh] w-[min(90vw,48rem)] rounded-2xl bg-white p-3 backdrop:bg-black/60">
      <button type="button" autoFocus onClick={() => previewDialog.current?.close()} className="mb-2 flex min-h-11 items-center gap-2 px-3 text-sm font-bold text-blue-700"><X className="size-4" />关闭预览</button>
      {preview && <div className="relative h-[70dvh]"><Image unoptimized src={preview} alt="已选截图大图" fill sizes="90vw" className="object-contain" /></div>}
    </dialog>
  </div>;
}

function EvidenceImage({ id, index }: { id: string; index: number }) {
  const [failed, setFailed] = useState(false);
  const src = `/api/support/attachments/${id}`;
  return <a href={src} target="_blank" rel="noreferrer" className="relative grid aspect-square place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50" aria-label={`查看截图证明 ${index + 1}，在新标签页打开`}>
    {failed ? <span className="p-2 text-center text-xs text-blue-700">加载失败，点击重试</span> : <Image unoptimized src={src} alt={`截图证明 ${index + 1}`} fill sizes="(max-width: 640px) 28vw, 200px" className="object-contain" onError={() => setFailed(true)} />}
  </a>;
}
export function SupportEvidence({ images }: { images: SupportAttachment[] }) {
  if (!images?.length) return null;
  return <div className="mt-3"><p className="mb-2 text-xs font-semibold text-slate-500">截图证明 · 点击查看大图</p><div className="grid grid-cols-3 gap-2">{images.map((image, index) => <EvidenceImage key={image.id} id={image.id} index={index} />)}</div></div>;
}
