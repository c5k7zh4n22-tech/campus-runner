import { getCurrentProfile } from "@/lib/data";
import { decodeSupportImages, readSupportRequest } from "@/lib/services/support-images";
import { supportQuery, supportMutation, SupportError } from "@/lib/support";
import { createSupport, getSupport, listSupport, supportOrders, updateSupport } from "@/lib/services/support";

export const dynamic = "force-dynamic";
function json(data: unknown,status=200) { return Response.json(data,{status,headers:{"Cache-Control":"private, no-store"}}); }
async function auth() {
  const profile = await getCurrentProfile();
  if (!profile) throw new SupportError("请先登录后联系客服",401);
  if (profile.status !== "active") throw new SupportError("当前账号无法使用客服功能",403);
  return profile;
}
function fail(error: unknown) {
  if (error instanceof SupportError) return json({error:error.message},error.status);
  console.error("Support request failed",error);
  return json({error:"客服服务暂时不可用，请稍后重试"},503);
}
export async function GET(request: Request) {
  try {
    const profile = await auth();
    const parsed = supportQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return json({error:"请求参数无效"},400);
    const input = parsed.data;
    if (input.view === "detail") return json(await getSupport(profile,input.id!,input.before));
    if (input.view === "orders") return json(await supportOrders(profile,input.page));
    return json(await listSupport(profile,input.admin === "true",input.page,input.status));
  } catch(error) { return fail(error); }
}
export async function POST(request: Request) {
  try {
    const origins = new Set([new URL(request.url).origin]);
    for (const value of [process.env.APP_URL,process.env.NEXT_PUBLIC_SITE_URL]) {
      if (value) { try { origins.add(new URL(value).origin); } catch { /* Invalid config is not trusted. */ } }
    }
    const contentType = request.headers.get("content-type") || "";
    if (!origins.has(request.headers.get("origin") || "") || !(contentType.startsWith("application/json") || contentType.startsWith("multipart/form-data"))) return json({error:"请求来源无效"},403);
    const profile = await auth();
    const { value, files } = await readSupportRequest(request);
    const parsed = supportMutation.safeParse(value);
    if (!parsed.success) return json({error:"请检查标题、描述和关联订单是否填写正确"},400);
    const input=parsed.data;
    if (input.action === "status" && files.length) return json({ error: "请在补充回复中添加截图" }, 400);
    const images = await decodeSupportImages(files);
    return json(input.action === "create" ? await createSupport(profile,input,images) : await updateSupport(profile,input,images));
  } catch(error) { return fail(error); }
}
