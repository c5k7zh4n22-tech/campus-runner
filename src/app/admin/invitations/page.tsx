import { AlertTriangle, UserPlus } from "lucide-react";
import { AdminNav } from "@/components/AdminNav";
import { EmptyState } from "@/components/EmptyState";
import { getAdminInvitationRelationships } from "@/lib/services/invitations";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const SOURCE_LABELS: Record<string, string> = {
  share_code: "分享短码",
  student_id: "学号邀请码"
};

export default async function AdminInvitationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const page = Number(params.page || "1");
  const data = await getAdminInvitationRelationships(Number.isFinite(page) ? page : 1);

  return (
    <>
      <AdminNav active="/admin/invitations" />
      <div>
        <div className="eyebrow">Invitations</div>
        <h1 className="page-title mt-3">邀请关系</h1>
        <p className="mt-3 text-sm text-slate-500">本期后台仅提供查询，不提供邀请归属转移、改绑或收益操作。</p>
      </div>

      {data.conflicts.length ? (
        <section className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 font-black text-amber-900"><AlertTriangle className="size-5" /> 重复认证学号冲突</div>
          <div className="mt-4 grid gap-3">
            {data.conflicts.map((conflict) => (
              <div key={conflict.id} className="rounded-xl bg-white/70 p-4 text-sm text-amber-900">
                <div className="font-black">{conflict.campus_name || "未知学校"} · {conflict.student_id}</div>
                <div className="mt-1 text-xs">涉及 {conflict.profile_count} 个账号 · 检测时间 {formatDate(conflict.detected_at)}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-7 card p-5 sm:p-7">
        <div className="flex items-center gap-2"><UserPlus className="size-5 text-blue-600" /><h2 className="text-lg font-black">已绑定邀请关系</h2></div>
        {data.relationships.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs text-slate-400">
                <tr>
                  <th className="py-3 pr-4">邀请人</th>
                  <th className="py-3 pr-4">受邀用户</th>
                  <th className="py-3 pr-4">来源</th>
                  <th className="py-3 pr-4">提交码</th>
                  <th className="py-3 pr-4">绑定时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.relationships.map((relationship) => (
                  <tr key={relationship.id}>
                    <td className="py-3 pr-4 font-bold text-slate-800">{relationship.inviter_name}</td>
                    <td className="py-3 pr-4 text-slate-600">{relationship.invitee_name}</td>
                    <td className="py-3 pr-4 text-slate-600">{SOURCE_LABELS[relationship.source] || relationship.source}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-500">{relationship.submitted_code}</td>
                    <td className="py-3 pr-4 text-slate-500">{formatDate(relationship.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="暂无邀请关系" description="用户注册时确认邀请码后会出现在这里。" icon={UserPlus} />
        )}
      </section>
    </>
  );
}
