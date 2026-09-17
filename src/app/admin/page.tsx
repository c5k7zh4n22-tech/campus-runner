import { Activity, CheckCircle2, Flag, ScrollText, UsersRound } from "lucide-react";
import { getAdminDashboard } from "@/lib/data";
import { AdminNav } from "@/components/AdminNav";

export default async function AdminDashboardPage() {
  const stats = await getAdminDashboard();
  const cards = [
    { label: "注册用户", value: stats.users, icon: UsersRound, tone: "bg-blue-50 text-blue-700" },
    { label: "全部订单", value: stats.orders, icon: ScrollText, tone: "bg-violet-50 text-violet-700" },
    { label: "待处理举报", value: stats.openReports, icon: Flag, tone: "bg-rose-50 text-rose-700" },
    { label: "已完成订单", value: stats.completed, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" }
  ];

  return (
    <>
      <AdminNav active="/admin" />
      <div>
        <div className="eyebrow">Admin console</div>
        <h1 className="page-title mt-3">管理概览</h1>
        <p className="mt-3 text-sm text-slate-500">所有管理权限都会在数据库 RLS 与服务端再次验证。</p>
      </div>
      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="card p-5">
            <div className={`grid size-10 place-items-center rounded-2xl ${tone}`}><Icon className="size-5" /></div>
            <div className="mt-5 text-3xl font-black">{value}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">{label}</div>
          </div>
        ))}
      </section>
      <section className="card mt-6 p-6">
        <div className="flex items-center gap-2 font-black"><Activity className="size-5 text-blue-600" /> 运营提醒</div>
        <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-600">
          <li>• 优先处理待审核校园认证，未认证用户无法接单。</li>
          <li>• 举报处理需要填写明确结论，关闭后保留处理记录。</li>
          <li>• 管理员不能直接修改用户手机号或学号，只能审核状态。</li>
        </ul>
      </section>
    </>
  );
}
