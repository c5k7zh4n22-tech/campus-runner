import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Coins, MapPin, PackageOpen } from "lucide-react";
import { createOrderAction } from "@/actions/orders";
import { getCampuses } from "@/lib/data";
import { requireProfile } from "@/lib/auth";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";

export const metadata: Metadata = { title: "发布跑腿" };

export default async function CreateOrderPage() {
  const profile = await requireProfile();
  const campuses = await getCampuses();

  if (!profile.campus_id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="card p-7 text-center">
          <h1 className="text-2xl font-black">请先选择你的学校</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">订单必须归属一个校园，完善资料后即可发布。</p>
          <Link className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white" href="/profile">完善个人资料</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <Link className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-700" href="/orders"><ArrowLeft className="size-4" /> 返回跑腿大厅</Link>
      <div className="mb-7">
        <div className="eyebrow">Create order</div>
        <h1 className="page-title mt-3">发布跑腿</h1>
        <p className="mt-3 text-sm text-slate-500">信息越清晰，越容易被快速接单。</p>
      </div>

      <ActionForm action={createOrderAction} className="card grid gap-5 p-5 sm:grid-cols-2 sm:p-8">
        <label className="label sm:col-span-2">
          <span className="flex items-center gap-2"><PackageOpen className="size-4 text-blue-600" /> 所属学校</span>
          <select className="field" name="campusId" defaultValue={profile.campus_id} required>
            {campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
          </select>
        </label>
        <label className="label">
          <span className="flex items-center gap-2"><MapPin className="size-4 text-orange-500" /> 取货地点</span>
          <input className="field" name="pickupLocation" placeholder="如：菜鸟驿站 3 号窗口" required />
        </label>
        <label className="label">
          <span className="flex items-center gap-2"><MapPin className="size-4 text-emerald-600" /> 送达地点</span>
          <input className="field" name="deliveryLocation" placeholder="如：6 号宿舍楼下" required />
        </label>
        <label className="label sm:col-span-2">
          跑腿描述
          <textarea className="field min-h-28 resize-y" name="description" placeholder="请说明需要取送什么、大小重量或注意事项。" minLength={5} maxLength={500} required />
        </label>
        <label className="label">
          <span className="flex items-center gap-2"><Coins className="size-4 text-amber-500" /> 跑腿费（元）</span>
          <input className="field" name="reward" type="number" inputMode="decimal" min="0.01" max="9999" step="0.01" placeholder="8.00" required />
        </label>
        <label className="label">
          <span className="flex items-center gap-2"><CalendarClock className="size-4 text-violet-600" /> 截止时间</span>
          <input className="field" name="deadline" type="datetime-local" required />
        </label>
        <div className="rounded-2xl bg-blue-50 p-4 text-xs leading-6 text-blue-800 sm:col-span-2">
          发布前请确认信息真实。平台第一版不包含在线支付，跑腿费由双方线下自行结算。
        </div>
        <SubmitButton className="w-full sm:col-span-2" pendingText="正在发布...">确认发布</SubmitButton>
      </ActionForm>
    </div>
  );
}
