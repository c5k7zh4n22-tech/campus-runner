import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool, type PoolClient } from "pg";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { Profile } from "./types";
import { canChangeSupportStatus, supportMutation } from "./support";

vi.mock("server-only",()=>({}));
vi.mock("@/lib/db",()=>({
  query:(sql:string,values?:unknown[])=>pool.query(sql,values),
  transaction:async(fn:(client:PoolClient)=>Promise<unknown>)=>{
    const client=await pool.connect();
    try {await client.query("begin");const result=await fn(client);await client.query("commit");return result;}
    catch(error){await client.query("rollback");throw error;}finally{client.release();}
  }
}));
vi.mock("@/lib/data",()=>({getCurrentProfile:async()=>current}));
import { createSupport, getSupport, listSupport, supportOrders, updateSupport } from "./services/support";
import { GET, POST } from "@/app/api/support/route";
import { GET as imageGET } from "@/app/api/support/attachments/[id]/route";
import { decodeSupportImages, readSupportRequest } from "./services/support-images";
let pool:Pool;
let current:Profile|null=null;
let people:Profile[];
let orderId:string;
const schema=`support_test_${randomUUID().replaceAll("-","")}`;
const input=()=>({category:"order",subject:"快递未收到",body:"对方显示送达，但宿舍楼下没有找到快递。",orderId,clientId:randomUUID()});

describe("support validation",()=>{
  it("rejects fake images, unsupported files and oversized uploads",async()=>{
    await expect(decodeSupportImages([new File(["not an image"],"fake.png",{type:"image/png"})])).rejects.toThrow("无法读取");
    await expect(decodeSupportImages([new File(["<svg/>"],"x.svg",{type:"image/svg+xml"})])).rejects.toThrow("JPG");
    await expect(decodeSupportImages([new File([new Uint8Array(819201)],"big.png",{type:"image/png"})])).rejects.toThrow("800KB");
    await expect(decodeSupportImages(Array.from({length:4},()=>new File(["x"],"x.png",{type:"image/png"})))).rejects.toThrow("3 张");
    await expect(readSupportRequest(new Request("http://localhost/api/support",{method:"POST",headers:{"content-type":"multipart/form-data; boundary=x"},body:new Uint8Array(3*1024*1024+1)}))).rejects.toMatchObject({status:413});
  });
  it("rejects empty descriptions and unauthorized status changes",()=>{
    expect(supportMutation.safeParse({action:"create",...input(),body:" "}).success).toBe(false);
    expect(canChangeSupportStatus("OPEN","RESOLVED",false)).toBe(false);
    expect(canChangeSupportStatus("RESOLVED","OPEN",false)).toBe(true);
    expect(canChangeSupportStatus("CLOSED","PROCESSING",true)).toBe(false);
    expect(canChangeSupportStatus("OPEN","PROCESSING",true)).toBe(true);
  });
});
describe.skipIf(!process.env.MESSAGE_TEST_DATABASE_URL)("support PostgreSQL",()=>{
  beforeAll(async()=>{
    pool=new Pool({connectionString:process.env.MESSAGE_TEST_DATABASE_URL,options:`-c search_path=${schema},public`});
    await pool.query(`create schema ${schema}`);
    for(const name of ["0001_postgres_app.sql","0002_messages.sql","0004_support.sql","0005_support_attachments.sql"]) await pool.query(await readFile(`migrations/${name}`,"utf8"));
  });
  afterAll(async()=>{if(pool){await pool.query(`drop schema ${schema} cascade`);await pool.end();}});
  beforeEach(async()=>{
    await pool.query("truncate app_users cascade");
    const campus=(await pool.query("select id from campuses limit 1")).rows[0].id;
    people=[];
    for(const role of ["user","user","admin","admin"]){
      const id=randomUUID();
      await pool.query("insert into app_users(id,email,password_hash) values($1,$2,'test')",[id,`${id}@example.test`]);
      people.push((await pool.query<Profile>("insert into profiles(id,display_name,campus_id,role) values($1,'测试同学',$2,$3) returning *",[id,campus,role])).rows[0]);
    }
    orderId=(await pool.query("insert into orders(publisher_id,campus_id,pickup_location,delivery_location,description,reward,deadline) values($1,$2,'驿站','宿舍','取快递',2,now()+interval '1 day') returning id",[people[0].id,campus])).rows[0].id;
    current=people[0];
  });
  it("isolates tickets and checks associated order ownership",async()=>{
    await expect(createSupport(people[1],input())).rejects.toMatchObject({status:403});
    const {id}=await createSupport(people[0],input());
    await expect(getSupport(people[1],id)).rejects.toMatchObject({status:404});
    await expect(updateSupport(people[1],{action:"reply",id,body:"越权回复",clientId:randomUUID()})).rejects.toMatchObject({status:404});
    await expect(listSupport(people[0],true,0)).rejects.toMatchObject({status:403});
    expect((await listSupport(people[1],false,0)).tickets).toHaveLength(0);
    expect((await supportOrders(people[1],0)).orders).toHaveLength(0);
    expect((await listSupport(people[2],true,0)).tickets).toHaveLength(1);
    expect((await getSupport(people[2],id)).isAdmin).toBe(true);
  });
  it("persists screenshot evidence, protects retrieval and deduplicates multipart retries",async()=>{
    const png=await sharp({create:{width:40,height:30,channels:3,background:'#2563eb'}}).png().toBuffer();
    const clientId=randomUUID();
    const upload=(payload:unknown)=>{
      const form=new FormData();form.set('payload',JSON.stringify(payload));form.append('screenshots',new File([new Uint8Array(png)],'evidence.png',{type:'image/png'}));
      return new Request('http://localhost/api/support',{method:'POST',headers:{origin:'http://localhost'},body:form});
    };
    const payload={action:'create',...input(),clientId};
    const first=await POST(upload(payload));expect(first.status).toBe(200);
    const {id}=await first.json();
    const retry=await POST(upload(payload));expect((await retry.json()).id).toBe(id);
    let detail=await getSupport(people[0],id);
    expect(detail.entries[0].attachments).toHaveLength(1);
    expect((await pool.query('select * from support_attachments')).rowCount).toBe(1);
    const attachment=detail.entries[0].attachments[0].id;
    const getImage=()=>imageGET(new Request(`http://localhost/api/support/attachments/${attachment}`),{params:Promise.resolve({id:attachment})});
    const image=await getImage();expect(image.status).toBe(200);expect(image.headers.get('cache-control')).toContain('no-store');
    expect(image.headers.get('content-type')).toBe('image/webp');
    expect((await sharp(Buffer.from(await image.arrayBuffer())).metadata()).width).toBe(40);
    current=people[1];expect((await getImage()).status).toBe(404);
    expect((await POST(upload({action:'reply',id,body:'越权补图',clientId:randomUUID()}))).status).toBe(404);
    current=null;expect((await getImage()).status).toBe(401);
    current=people[2];expect((await getImage()).status).toBe(200);
    const reply={action:'reply',id,body:'客服补充截图说明',clientId:randomUUID()};
    expect((await POST(upload(reply))).status).toBe(200);
    expect((await POST(upload(reply))).status).toBe(200);
    detail=await getSupport(people[0],id);expect(detail.entries).toHaveLength(2);expect(detail.entries[1].attachments).toHaveLength(1);
    current={...people[0],status:'banned'};expect((await getImage()).status).toBe(403);
    expect((await pool.query('select * from support_attachments')).rowCount).toBe(2);
  });
  it("deduplicates concurrent creation and replies including notifications",async()=>{
    const payload=input();
    const [a,b]=await Promise.all([createSupport(people[0],payload),createSupport(people[0],payload)]);
    expect(a.id).toBe(b.id);
    expect((await pool.query("select * from support_entries")).rows).toHaveLength(1);
    const reply={action:"reply" as const,id:a.id,body:"请说明取件时间",clientId:randomUUID()};
    await Promise.all([updateSupport(people[2],reply),updateSupport(people[2],reply)]);
    const ticket=await getSupport(people[0],a.id);
    expect(ticket.entries).toHaveLength(2);
    expect(ticket.ticket.status).toBe("WAITING_USER");
    expect((await pool.query("select * from notifications where recipient_id=$1",[people[0].id])).rows).toHaveLength(1);
    await updateSupport(people[0],{action:"reply",id:a.id,body:"下午两点",clientId:randomUUID()});
    expect((await getSupport(people[0],a.id)).ticket.status).toBe("PROCESSING");
  });
  it("requires resolution notes, protects concurrent state and permits reopening",async()=>{
    const {id}=await createSupport(people[0],input());
    await expect(updateSupport(people[0],{action:"status",id,status:"RESOLVED",body:"自己解决",version:1,clientId:randomUUID()})).rejects.toMatchObject({status:403});
    const results=await Promise.allSettled(people.slice(2).map(profile=>updateSupport(profile,{action:"status",id,status:"PROCESSING",body:"已受理，正在核实",version:1,clientId:randomUUID()})));
    expect(results.filter(result=>result.status==="fulfilled")).toHaveLength(1);
    expect(results.filter(result=>result.status==="rejected")).toHaveLength(1);
    await updateSupport(people[2],{action:"status",id,status:"RESOLVED",body:"已协助找回快递",version:2,clientId:randomUUID()});
    await expect(updateSupport(people[0],{action:"reply",id,body:"还有疑问",clientId:randomUUID()})).rejects.toMatchObject({status:409});
    await updateSupport(people[0],{action:"status",id,status:"OPEN",body:"仍有问题需要协助",version:3,clientId:randomUUID()});
    expect((await getSupport(people[0],id)).ticket.status).toBe("OPEN");
    expect((await pool.query("select status from orders where id=$1",[orderId])).rows[0].status).toBe("PENDING");
  });
  it("paginates numeric history without overlap and limits spam",async()=>{
    const {id}=await createSupport(people[0],input());
    await pool.query("insert into support_entries(ticket_id,actor_id,actor_role,body,kind,client_id) select $1,$2,'user','补充说明','message',gen_random_uuid() from generate_series(1,85)",[id,people[0].id]);
    const latest=await getSupport(people[0],id);
    const older=await getSupport(people[0],id,latest.entries[0].id);
    expect(latest.entries).toHaveLength(40);expect(older.entries).toHaveLength(40);
    expect(new Set([...latest.entries,...older.entries].map(entry=>entry.id)).size).toBe(80);
    for(let i=0;i<4;i++)await createSupport(people[0],input());
    await expect(createSupport(people[0],input())).rejects.toMatchObject({status:429});
  });
  it("requires API auth, valid origin, valid payload and an active account",async()=>{
    current=null;expect((await GET(new Request("http://localhost/api/support"))).status).toBe(401);
    current=people[0];
    const req=(origin:string,body:unknown)=>new Request("http://localhost/api/support",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(body)});
    expect((await POST(req("https://evil.example",{action:"create",...input()}))).status).toBe(403);
    expect((await POST(req("http://localhost",{action:"create",...input(),body:""}))).status).toBe(400);
    expect((await GET(new Request("http://localhost/api/support?admin=true"))).status).toBe(403);
    current={...people[0],status:"banned"};
    expect((await POST(req("http://localhost",{action:"create",...input()}))).status).toBe(403);
  });
});
