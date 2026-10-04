import { z } from "zod";
import { getCurrentProfile } from "@/lib/data";
import { getSupportImage } from "@/lib/services/support";
import { SupportError } from "@/lib/support";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" };
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return Response.json({ error: "请先登录" }, { status: 401, headers: privateHeaders });
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return Response.json({ error: "截图编号无效" }, { status: 400, headers: privateHeaders });
    const image = await getSupportImage(profile, id);
    return new Response(new Uint8Array(image.data), { headers: {
      ...privateHeaders, "Content-Type": image.content_type, "Content-Disposition": 'inline; filename="support-evidence.webp"',
      "Content-Security-Policy": "default-src 'none'; sandbox", "Content-Length": String(image.data.length)
    } });
  } catch (error) {
    if (error instanceof SupportError) return Response.json({ error: error.message }, { status: error.status, headers: privateHeaders });
    console.error("Support attachment failed", error);
    return Response.json({ error: "截图暂时无法加载" }, { status: 503, headers: privateHeaders });
  }
}
