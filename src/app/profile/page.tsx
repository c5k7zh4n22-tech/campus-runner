import type { Metadata } from "next";
import { BadgeCheck, Camera, ShieldCheck, Star, UserRound } from "lucide-react";
import { updateProfileAction, submitVerificationAction, uploadAvatarAction } from "@/actions/profile";
import { getCampuses, getReviewsForUser } from "@/lib/data";
import { requireProfile } from "@/lib/auth";
import { VERIFICATION_LABELS } from "@/lib/constants";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";

export const metadata: Metadata = { title: "个人资料" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ verification?: string }> }) {
  const profile = await requireProfile();
  const [campuses, reviews, params] = await Promise.all([getCampuses(), getReviewsForUser(profile.id), searchParams]);
  const verificationTone = profile.verification_status === "verified" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : profile.verification_status === "rejected" ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-amber-50 text-amber-700 ring-amber-200";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {params.verification === "required" ? <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">完成校园认证后才能接单。</div> : null}

      <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-9">
          <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-3xl bg-white/10 ring-1 ring-white/15">
            {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="size-full object-cover" /> : <UserRound className="size-10 text-white/60" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black">{profile.display_name}</h1>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${verificationTone}`}>{VERIFICATION_LABELS[profile.verification_status]}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/55">
              <span className="flex items-center gap-1.5"><Star className="size-4 text-amber-400" /> {Number(profile.rating).toFixed(1)} 分 · {profile.review_count} 条评价</span>
              <span className="flex items-center gap-1.5"><BadgeCheck className="size-4 text-blue-400" /> {campuses.find((campus) => campus.id === profile.campus_id)?.name || "尚未选择学校"}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card p-5 sm:p-7">
            <h2 className="text-lg font-black">基本资料</h2>
            <p className="mt-1 text-xs text-slate-400">昵称和学校会展示在订单页面。</p>
            <ActionForm action={updateProfileAction} className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="label">昵称<input className="field" name="displayName" defaultValue={profile.display_name} minLength={2} maxLength={30} required /></label>
              <label className="label">学校<select className="field" name="campusId" defaultValue={profile.campus_id || ""} required><option value="" disabled>请选择学校</option>{campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}</select></label>
              <input type="hidden" name="phone" value={profile.phone || ""} />
              <input type="hidden" name="studentId" value={profile.student_id || ""} />
              <SubmitButton className="sm:col-span-2">保存资料</SubmitButton>
            </ActionForm>
          </section>

          <section className="card p-5 sm:p-7">
            <div className="flex items-center gap-2"><ShieldCheck className="size-5 text-emerald-600" /><h2 className="text-lg font-black">校园身份认证</h2></div>
            <p className="mt-2 text-sm leading-6 text-slate-500">提交学号和手机号后由管理员人工审核。敏感信息不会出现在公开订单中。</p>
            <ActionForm action={submitVerificationAction} className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="label">学号<input className="field" name="studentId" defaultValue={profile.student_id || ""} maxLength={40} required /></label>
              <label className="label">手机号<input className="field" name="phone" type="tel" inputMode="numeric" pattern="1[3-9][0-9]{9}" defaultValue={profile.phone || ""} placeholder="11 位手机号" required /></label>
              <SubmitButton className="sm:col-span-2" pendingText="正在提交...">
                {profile.verification_status === "verified" ? "重新提交认证" : "提交认证"}
              </SubmitButton>
            </ActionForm>
          </section>

          <section className="card p-5 sm:p-7">
            <h2 className="text-lg font-black">收到的评价</h2>
            {reviews.length ? <div className="mt-4 space-y-3">{reviews.map((review) => <div key={review.id} className="rounded-2xl bg-slate-50 p-4"><div className="text-amber-500">{"★".repeat(review.rating)}</div>{review.comment ? <p className="mt-2 text-sm text-slate-600">{review.comment}</p> : null}</div>)}</div> : <p className="mt-4 text-sm text-slate-400">完成订单后，其他用户对你的评价会显示在这里。</p>}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5 sm:p-7">
            <div className="flex items-center gap-2"><Camera className="size-5 text-blue-600" /><h2 className="text-lg font-black">头像</h2></div>
            <p className="mt-2 text-xs leading-5 text-slate-400">支持 JPG、PNG、WebP，最大 2MB。</p>
            <ActionForm action={uploadAvatarAction} className="mt-5 grid gap-4">
              <input className="field py-2 text-sm" type="file" name="avatar" accept="image/jpeg,image/png,image/webp" required />
              <SubmitButton variant="outline">上传头像</SubmitButton>
            </ActionForm>
          </section>
          <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-xs leading-6 text-blue-800">
            <strong className="block text-sm text-blue-950">隐私说明</strong>
            手机号仅在双方接单后相互可见；管理员审核时可以看到认证资料。平台第一版不提供聊天功能。
          </section>
        </aside>
      </div>
    </div>
  );
}
