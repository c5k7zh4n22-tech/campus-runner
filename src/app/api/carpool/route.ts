import { getCurrentProfile } from "@/lib/data";
import { carpoolMutation,carpoolQuery,CarpoolError } from "@/lib/carpool";
import { carpoolPlaces,listCarpools,carpoolDetail,carpoolChat,mutateCarpool } from "@/lib/services/carpool";
export const dynamic="force-dynamic";
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
async function auth(){const p=await getCurrentProfile();if(!p)throw new CarpoolError("请先登录",401);return p;}
function failure(error:unknown){if(error instanceof CarpoolError)return json({error:error.message},error.status);console.error("Carpool request failed",error);return json({error:"拼车服务暂不可用，请稍后重试"},503);}
export async function GET(request:Request){try{
 const p=await auth(),parsed=carpoolQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!parsed.success)return json({error:"请求参数无效"},400);const q=parsed.data;
 if(q.view==="places")return json(await carpoolPlaces(p));if(q.view==="detail")return json(await carpoolDetail(p,q.id!));if(q.view==="chat")return json(await carpoolChat(p,q.id!,q.before,q.after));return json(await listCarpools(p,q));
}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 const origins=new Set([new URL(request.url).origin]);for(const url of [process.env.APP_URL,process.env.NEXT_PUBLIC_SITE_URL]){if(url){try{origins.add(new URL(url).origin);}catch{}}}
 if(!origins.has(request.headers.get("origin")||"")||!request.headers.get("content-type")?.startsWith("application/json"))return json({error:"请求来源无效"},403);
 const p=await auth();if(Number(request.headers.get("content-length"))>16000)return json({error:"内容过长"},413);
 const raw=await request.text();if(raw.length>16000)return json({error:"内容过长"},413);
 let input:unknown;try{input=JSON.parse(raw);}catch{return json({error:"请求格式无效"},400);}
 const parsed=carpoolMutation.safeParse(input);if(!parsed.success){
  const fields:Record<string,string>={originName:"出发地",destinationName:"目的地",originId:"出发地",destinationId:"目的地",start:"最早出发时间",end:"最晚出发时间",partySize:"同行人数",capacity:"计划总人数",meeting:"集合说明",luggage:"行李说明"};
  const field=fields[String(parsed.error.issues[0]?.path[0])];
  return json({error:field?`请检查${field}是否填写完整且符合要求`:"请检查地点、时间、人数和填写内容"},400);
 }
 return json(await mutateCarpool(p,parsed.data));
}catch(e){return failure(e);}}
