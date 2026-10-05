import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Camera, Coins, PackageOpen, ShieldCheck } from "lucide-react";
import { createListingAction } from "@/actions/marketplace";
import { requireProfile } from "@/lib/auth";
import { LISTING_CATEGORY_LABELS, LISTING_CONDITION_LABELS } from "@/lib/constants";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";

export const metadata: Metadata = { title: "发布闲置" };

export default async function CreateListingPage() {
  const profile = await requireProfile();

  if (profile.verification_status !== "verified") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="card p-7 text-center">
          <ShieldCheck className="mx-auto size-10 text-amber-500" />
          <h1 className="mt-4 text-2xl font-black">完成校园认证后才能发布闲置</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">认证需要 12 位学号和有效手机号。</p>
          <Link className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white" href="/profile">前往认证</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:py-12">
      <Link className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-700" href="/marketplace"><ArrowLeft className="size-4" /> 返回闲置市场</Link>
      <div className="mb-7">
        <div className="eyebrow">Sell something</div>
        <h1 className="page-title mt-3">发布闲置</h1>
        <p className="mt-3 text-sm text-slate-500">同校认证用户可选择平台交易或线下自行交易。请勿发布违规、危险或来源不明的物品。</p>
      </div>

      <ActionForm action={createListingAction} className="card grid gap-5 p-5 sm:grid-cols-2 sm:p-8">
        <label className="label sm:col-span-2">商品标题<input className="field" name="title" minLength={2} maxLength={80} placeholder="例如：高等数学教材 第七版" required /></label>
        <label className="label sm:col-span-2">商品描述<textarea className="field min-h-32 resize-y" name="description" minLength={5} maxLength={1500} placeholder="说明新旧程度、购买时间、配件和交易地点等。" required /></label>
        <label className="label"><span className="flex items-center gap-2"><Coins className="size-4 text-amber-500" /> 价格（元）</span><input className="field" name="price" type="number" inputMode="decimal" min="0" max="99999" step="0.01" placeholder="线下交易可填 0" required /></label>
        <label className="label"><span className="flex items-center gap-2"><PackageOpen className="size-4 text-blue-600" /> 分类</span><select className="field" name="category" defaultValue="books">{Object.entries(LISTING_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="label sm:col-span-2">成色<select className="field" name="itemCondition" defaultValue="good">{Object.entries(LISTING_CONDITION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <fieldset className="grid gap-3 sm:col-span-2">
          <legend className="text-sm font-bold text-slate-800">交易方式</legend>
          <label className="flex min-h-16 cursor-pointer items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><input className="mt-1 size-4 shrink-0" type="radio" name="tradeMode" value="PLATFORM" required /><span><strong className="block">平台交易</strong><span className="text-xs text-blue-700">买卖双方在平台内完成交易流程，成交后向卖家收取 1% 基础软件服务费。真实扣款需接入微信支付后生效。</span></span></label>
          <label className="flex min-h-16 cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700"><input className="mt-1 size-4 shrink-0" type="radio" name="tradeMode" value="OFFLINE" defaultChecked required /><span><strong className="block text-slate-900">线下自行交易</strong><span className="text-xs text-slate-500">不通过平台付款，双方自行确认商品、地点和付款方式，价格可以填写 0 元。</span></span></label>
        </fieldset>
        <label className="label sm:col-span-2"><span className="flex items-center gap-2"><Camera className="size-4 text-blue-600" /> 商品图片（选填）</span><input className="field py-2 text-sm" name="image" type="file" accept="image/jpeg,image/png,image/webp" /><small className="font-normal text-slate-400">支持 JPG、PNG、WebP，最大 5MB。</small></label>
        <div className="rounded-2xl bg-blue-50 p-4 text-xs leading-6 text-blue-800 sm:col-span-2">平台交易成交后按商品金额向卖家收取 1% 基础软件服务费；线下自行交易不通过平台付款，请先确认商品和交易对象。</div>
        <div className="sticky bottom-24 z-20 rounded-2xl bg-white/90 p-2 shadow-lg shadow-slate-950/10 backdrop-blur sm:col-span-2 md:static md:bg-transparent md:p-0 md:shadow-none">
          <SubmitButton className="w-full" pendingText="正在发布...">确认发布</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
