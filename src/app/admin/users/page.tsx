import { BadgeCheck, Ban, CircleUserRound, ShieldCheck, UserCheck } from "lucide-react";
import { getAdminUsers, getVerificationQueue } from "@/lib/data";
import { reviewVerificationAction, setUserStatusAction } from "@/actions/admin";
import { VERIFICATION_LABELS } from "@/lib/constants";
import { AdminNav } from "@/components/AdminNav";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { EmptyState } from "@/components/EmptyState";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const [users, queue] = await Promise.all([getAdminUsers(params.status), getVerificationQueue()]);

  return (
    <>
      <AdminNav active="/admin/users" />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><div className="eyebrow">Users</div><h1 className="page-title mt-3">用户管理</h1><p className="mt-3 text-sm text-slate-500">处理认证、封禁与账号恢复。</p></div>
        <form className="flex gap-2"><select className="field min-w-32" name="status" defaultValue={params.status || "ALL"}><option value="ALL">全部状态</option><option value="active">正常</option><option value="suspended">暂停</option><option value="banned">封禁</option></select><button className="rounded-xl bg-slate-900 px-4 text-sm font-bold text-white">筛选</button></form>
      </div>

      <section className="mt-7">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-black"><BadgeCheck className="size-5 text-amber-500" /> 待审核认证 <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{queue.length}</span></h2>
        {queue.length ? <div className="grid gap-4 lg:grid-cols-2">{queue.map((user) => <article key={user.id} className="card p-5"><div className="flex items-start justify-between gap-4"><div><div className="font-black">{user.display_name}</div><div className="mt-1 text-xs text-slate-400">学号 {user.student_id || "未填写"} · {user.phone || "未填写手机号"}</div></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">待审核</span></div><div className="mt-4 grid grid-cols-2 gap-2"><ActionForm action={reviewVerificationAction}><input type="hidden" name="userId" value={user.id} /><input type="hidden" name="status" value="verified" /><SubmitButton className="w-full" variant="primary">通过认证</SubmitButton></ActionForm><ActionForm action={reviewVerificationAction}><input type="hidden" name="userId" value={user.id} /><input type="hidden" name="status" value="rejected" /><SubmitButton className="w-full" variant="outline">拒绝</SubmitButton></ActionForm></div></article>)}</div> : <EmptyState title="暂无待审核认证" description="新的校园认证申请会出现在这里。" icon={ShieldCheck} />}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-black">用户列表</h2>
        <div className="space-y-3">
          {users.map((user) => <article key={user.id} className="card grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-full bg-slate-100 text-slate-500"><CircleUserRound className="size-5" /></div><div><div className="font-black">{user.display_name} {user.role === "admin" ? <span className="ml-1 rounded bg-violet-100 px-2 py-0.5 text-[10px] text-violet-700">管理员</span> : null}</div><div className="mt-1 text-xs text-slate-400">{VERIFICATION_LABELS[user.verification_status]} · {user.status} · 评分 {Number(user.rating).toFixed(1)}</div></div></div><div className="flex flex-wrap gap-2">{user.status !== "active" ? <ActionForm action={setUserStatusAction}><input type="hidden" name="userId" value={user.id} /><input type="hidden" name="status" value="active" /><SubmitButton variant="outline"><UserCheck className="size-4" />恢复</SubmitButton></ActionForm> : null}{user.status !== "suspended" && user.role !== "admin" ? <ActionForm action={setUserStatusAction}><input type="hidden" name="userId" value={user.id} /><input type="hidden" name="status" value="suspended" /><SubmitButton variant="outline">暂停</SubmitButton></ActionForm> : null}{user.status !== "banned" && user.role !== "admin" ? <ActionForm action={setUserStatusAction} confirmMessage="确定封禁该用户吗？"><input type="hidden" name="userId" value={user.id} /><input type="hidden" name="status" value="banned" /><SubmitButton variant="danger"><Ban className="size-4" />封禁</SubmitButton></ActionForm> : null}</div></article>)}
        </div>
      </section>
    </>
  );
}
