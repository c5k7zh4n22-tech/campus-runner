import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Link2, ShieldCheck, UsersRound } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getInvitationDashboard } from "@/lib/services/invitations";
import { CopyButton } from "@/components/CopyButton";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/EmptyState";

export const metadata: Metadata = { title: "邀请同学" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function InvitationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const [profile, params] = await Promise.all([requireProfile(), searchParams]);
  const page = Number(params.page || "1");
  const data = await getInvitationDashboard(profile.id, Number.isFinite(page) ? page : 1);
  const totalPages = Math.max(1, Math.ceil(data.invitedCount / data.pageSize));

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-12 lg:px-8">
      <Link href="/profile" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-700">
        <ArrowLeft className="size-4" /> 返回我的
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow">Invite classmates</div>
          <h1 className="page-title mt-3">邀请同学</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">邀请关系只记录直接邀请人和受邀同学，本期不展示收益、返佣或提现信息。</p>
        </div>
        <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-black text-blue-700">
          已邀请 {data.invitedCount} 人
        </div>
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="card p-5 sm:p-7">
          <div className="flex items-center gap-2"><Link2 className="size-5 text-blue-600" /><h2 className="text-lg font-black">我的邀请方式</h2></div>
          {data.canInvite ? (
            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs font-bold text-slate-400">随机分享短码</div>
                <div className="mt-2 break-all text-2xl font-black tracking-wide text-slate-900">{data.inviteCode}</div>
                <p className="mt-2 text-xs text-slate-500">日常分享请使用短码链接，不会暴露完整学号。</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs font-bold text-slate-400">学号邀请码</div>
                <div className="mt-2 text-lg font-black text-slate-900">{data.studentInviteCode || "认证资料缺少学号"}</div>
                <p className="mt-2 text-xs text-slate-500">同学手动填写时可使用，系统按莆田学院 + 已审核学号查找邀请人。</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs font-bold text-slate-400">邀请链接</div>
                <div className="mt-2 break-all text-sm font-bold text-slate-800">{data.inviteLink}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <CopyButton value={data.inviteCode} label="复制邀请码" />
                <CopyButton value={data.inviteLink} label="复制邀请链接" />
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
              <div className="flex items-center gap-2 font-black"><ShieldCheck className="size-5" /> 完成校园认证后才能邀请同学</div>
              <p className="mt-2">认证未通过、被撤销或账号停用时不会开放有效邀请链接，已有邀请关系会保留。</p>
              <ButtonLink className="mt-4" href="/profile" variant="primary">前往认证</ButtonLink>
            </div>
          )}
        </div>

        <aside className="card p-5 sm:p-7">
          <div className="flex items-center gap-2"><BadgeCheck className="size-5 text-emerald-600" /><h2 className="text-lg font-black">我的邀请人</h2></div>
          {data.inviter ? (
            <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
              <div className="font-black">{data.inviter.maskedName} · {data.inviter.campusName}</div>
              <div className="mt-2 text-xs">绑定时间：{formatDate(data.inviter.createdAt)}</div>
            </div>
          ) : (
            <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">未绑定邀请人</p>
          )}
        </aside>
      </section>

      <section className="mt-6 card p-5 sm:p-7">
        <div className="flex items-center gap-2"><UsersRound className="size-5 text-blue-600" /><h2 className="text-lg font-black">直接邀请列表</h2></div>
        {data.invitedUsers.length ? (
          <div className="mt-4 divide-y divide-slate-100">
            {data.invitedUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <div className="font-black text-slate-800">{user.maskedName}</div>
                  <div className="mt-1 text-xs text-slate-400">加入时间：{formatDate(user.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="还没有邀请记录" description="同学通过你的邀请码完成注册后会显示在这里。" icon={UsersRound} />
        )}

        {totalPages > 1 ? (
          <div className="mt-5 flex items-center justify-between text-sm font-bold">
            <Link className={data.page <= 1 ? "pointer-events-none text-slate-300" : "text-blue-700"} href={`/profile/invitations?page=${data.page - 1}`}>上一页</Link>
            <span className="text-slate-400">{data.page} / {totalPages}</span>
            <Link className={data.page >= totalPages ? "pointer-events-none text-slate-300" : "text-blue-700"} href={`/profile/invitations?page=${data.page + 1}`}>下一页</Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
