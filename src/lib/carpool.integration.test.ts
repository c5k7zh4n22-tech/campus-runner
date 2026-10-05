import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
import {Pool,type PoolClient} from "pg";
import {readFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import type {Profile} from "./types";
import {carpoolMutation,carpoolQuery,type CarpoolMutation} from "./carpool";
vi.mock("server-only",()=>({}));
vi.mock("@/lib/db",()=>({query:(sql:string,values?:unknown[])=>pool.query(sql,values),transaction:async(fn:(c:PoolClient)=>Promise<unknown>)=>{const c=await pool.connect();try{await c.query("begin");const r=await fn(c);await c.query("commit");return r;}catch(e){await c.query("rollback");throw e;}finally{c.release();}}}));
vi.mock("@/lib/data",()=>({getCurrentProfile:async()=>current}));
import {mutateCarpool,carpoolDetail,carpoolChat,listCarpools,carpoolPlaces} from "./services/carpool";
import {messageSummary,markAllRead} from "./services/messages";
import {createSupport,getSupport} from "./services/support";
import {GET,POST} from "@/app/api/carpool/route";
let pool:Pool;let people:Profile[];let current:Profile|null;let places:string[];let campus:string;
const schema=`carpool_test_${randomUUID().replaceAll('-','')}`;
function input():Extract<CarpoolMutation,{action:"create"}>{return{action:"create",originId:places[0],destinationId:places[1],start:new Date(Date.now()+3600000).toISOString(),end:new Date(Date.now()+7200000).toISOString(),partySize:1,capacity:3,luggage:"一个背包",meeting:"北侧集合点，仅成员可见",clientId:randomUUID()};}
async function create(extra:Partial<ReturnType<typeof input>>={}){const r=await mutateCarpool(people[0],{...input(),...extra});return (r as {id:string}).id;}
describe("carpool validation",()=>{it("rejects malformed filters and capacities",()=>{expect(carpoolQuery.safeParse({view:"chat",id:"x"}).success).toBe(false);expect(carpoolQuery.safeParse({from:"2026-10-06T10:00:00Z",to:"2026-10-05T10:00:00Z"}).success).toBe(false);expect(carpoolMutation.safeParse({action:"apply",id:randomUUID(),partySize:0}).success).toBe(false);});});
describe.skipIf(!process.env.MESSAGE_TEST_DATABASE_URL)("carpool PostgreSQL",()=>{
 beforeAll(async()=>{pool=new Pool({connectionString:process.env.MESSAGE_TEST_DATABASE_URL,options:`-c search_path=${schema},public`});await pool.query(`create schema ${schema}`);for(const name of ["0001_postgres_app.sql","0002_messages.sql","0004_support.sql","0005_support_attachments.sql","0006_carpool.sql","0007_carpool_gender.sql"])await pool.query(await readFile(`migrations/${name}`,"utf8"));});
 afterAll(async()=>{if(pool){try{await pool.query(`drop schema ${schema} cascade`);}finally{await pool.end();}}});
 beforeEach(async()=>{await pool.query("truncate app_users,carpool_places cascade");campus=(await pool.query("select id from campuses limit 1")).rows[0].id;people=[];for(let i=0;i<5;i++){const id=randomUUID();await pool.query("insert into app_users(id,email,password_hash) values($1,$2,'test')",[id,`${id}@example.test`]);people.push((await pool.query<Profile>("insert into profiles(id,campus_id,display_name,role,verification_status) values($1,$2,$3,$4,'verified') returning *",[id,campus,`测试用户${i}`,i===4?'admin':'user'])).rows[0]);}places=[];for(const name of ['测试校门','测试车站','测试广场'])places.push((await pool.query("insert into carpool_places(campus_id,name) values($1,$2) returning id",[campus,name])).rows[0].id);current=people[0];});
 it("requires certification, correct campus and configured active places",async()=>{
  await expect(mutateCarpool({...people[0],verification_status:'pending'},input())).rejects.toMatchObject({status:403});
  await expect(create({originId:randomUUID()})).rejects.toThrow("地点");await expect(create({partySize:3})).rejects.toThrow("已有");
  await mutateCarpool(people[4],{action:'place',id:places[2],name:'测试广场',active:false});await expect(create({destinationId:places[2]})).rejects.toThrow("地点");
  expect((await carpoolPlaces(people[0])).places).toHaveLength(2);
  const id=await create();await expect(carpoolDetail({...people[1],campus_id:randomUUID()},id)).rejects.toMatchObject({status:404});
  await expect(mutateCarpool({...people[1],verification_status:'unverified'},{action:'apply',id,partySize:1})).rejects.toMatchObject({status:403});
 });
 it("defaults to unrestricted and enforces declarations at creation, application and approval",async()=>{
  const open=await create();expect((await carpoolDetail(people[0],open)).trip.gender_preference).toBe('ANY');
  await mutateCarpool(people[1],{action:'apply',id:open,partySize:1});
  await expect(create({genderPreference:'FEMALE'})).rejects.toThrow('本人及已有同行');
  const women=await create({genderPreference:'FEMALE',genderConfirmed:true});
  await expect(mutateCarpool(people[1],{action:'apply',id:women,partySize:2})).rejects.toThrow('全部同行');
  await mutateCarpool(people[1],{action:'apply',id:women,partySize:2,genderConfirmed:true});
  await pool.query("update carpool_members set gender_confirmed=false where trip_id=$1 and user_id=$2",[women,people[1].id]);
  await expect(mutateCarpool(people[0],{action:'respond',id:women,userId:people[1].id,accept:true})).rejects.toMatchObject({status:409});
  await pool.query("update carpool_members set gender_confirmed=true where trip_id=$1 and user_id=$2",[women,people[1].id]);
  await mutateCarpool(people[0],{action:'respond',id:women,userId:people[1].id,accept:true});
  expect((await carpoolDetail(people[0],women)).trip.occupied).toBe(3);
  const men=await create({genderPreference:'MALE',genderConfirmed:true});
  expect((await listCarpools(people[1],{mine:'false',page:0,gender:'MALE'})).trips.map(t=>t.id)).toEqual([men]);
  expect((await listCarpools(people[1],{mine:'false',page:0,gender:'ANY'})).trips.map(t=>t.id)).toEqual([open]);
  expect(carpoolQuery.safeParse({gender:'unknown'}).success).toBe(false);
  expect(carpoolMutation.safeParse({...input(),genderPreference:'unknown'}).success).toBe(false);
  expect(carpoolMutation.safeParse({action:'apply',id:men,partySize:1,genderConfirmed:'true'}).success).toBe(false);
 });
 it("deduplicates creation, rejects duplicate membership and serializes last-slot approvals",async()=>{
  const payload={...input(),capacity:2};const [a,b]=await Promise.all([mutateCarpool(people[0],payload),mutateCarpool(people[0],payload)]);const id=(a as {id:string}).id;expect((b as {id:string}).id).toBe(id);
  for(const p of people.slice(1,3))await mutateCarpool(p,{action:'apply',id,partySize:1});
  expect((await carpoolDetail(people[0],id)).trip.occupied).toBe(1);
  await expect(mutateCarpool(people[1],{action:'apply',id,partySize:1})).rejects.toMatchObject({status:409});
  const approved=await Promise.allSettled(people.slice(1,3).map(p=>mutateCarpool(people[0],{action:'respond',id,userId:p.id,accept:true})));
  expect(approved.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(approved.filter(r=>r.status==='rejected')).toHaveLength(1);
  expect((await carpoolDetail(people[0],id)).trip.display_status).toBe('FULL');
  const winner=(await pool.query("select user_id from carpool_members where trip_id=$1 and status='APPROVED' and user_id<>$2",[id,people[0].id])).rows[0].user_id;
  await mutateCarpool(people.find(p=>p.id===winner)!,{action:'leave',id});expect((await carpoolDetail(people[0],id)).trip.display_status).toBe('OPEN');
 });
 it("protects group chat and meeting details before joining and after withdrawal",async()=>{
  const id=await create();await mutateCarpool(people[0],{action:'send',id,body:'加入前消息',clientId:randomUUID()});
  expect((await carpoolDetail(people[1],id)).meeting).toBeNull();expect((await carpoolDetail(people[1],id)).members).toHaveLength(0);
  await mutateCarpool(people[1],{action:'apply',id,partySize:1});await expect(carpoolChat(people[1],id)).rejects.toMatchObject({status:403});
  await mutateCarpool(people[0],{action:'respond',id,userId:people[1].id,accept:true});
  expect((await carpoolDetail(people[1],id)).meeting).toContain('仅成员可见');expect((await carpoolChat(people[1],id)).messages).toHaveLength(0);
  await markAllRead(people[1].id);
  const payload={action:'send' as const,id,body:'确认集合',clientId:randomUUID()};await Promise.all([mutateCarpool(people[0],payload),mutateCarpool(people[0],payload)]);
  const chat=await carpoolChat(people[1],id);expect(chat.messages).toHaveLength(1);expect((await messageSummary(people[1].id)).carpoolGroups[0].unread).toBe(1);
  await mutateCarpool(people[1],{action:'read',id,through:chat.messages[0].id});expect((await messageSummary(people[1].id)).total).toBe(0);
  await mutateCarpool(people[1],{action:'leave',id});await expect(carpoolChat(people[1],id)).rejects.toMatchObject({status:403});
  await expect(mutateCarpool(people[1],{action:'send',id,body:'退出后消息',clientId:randomUUID()})).rejects.toMatchObject({status:403});
  expect((await carpoolDetail(people[1],id)).meeting).toBeNull();expect((await messageSummary(people[1].id)).carpoolGroups).toHaveLength(0);
  await expect(carpoolChat(people[4],id)).rejects.toMatchObject({status:403});
 });
 it("handles expiry, departure, completion and cancellation with version checks",async()=>{
  const id=await create();await expect(mutateCarpool(people[1],{action:'state',id,state:'CANCELLED',version:1})).rejects.toMatchObject({status:403});
  await expect(mutateCarpool(people[0],{action:'state',id,state:'DEPARTED',version:1})).rejects.toMatchObject({status:409});
  await pool.query("update carpool_trips set departure_start=now()-interval '1 minute',departure_end=now()+interval '1 hour' where id=$1",[id]);
  await mutateCarpool(people[0],{action:'state',id,state:'DEPARTED',version:1});
  await expect(mutateCarpool(people[1],{action:'apply',id,partySize:1})).rejects.toMatchObject({status:409});
  await mutateCarpool(people[0],{action:'state',id,state:'COMPLETED',version:2});expect((await carpoolChat(people[0],id)).readOnly).toBe(true);
  const expired=await create();await pool.query("update carpool_trips set departure_start=now()-interval '2 hours',departure_end=now()-interval '1 hour' where id=$1",[expired]);
  expect((await carpoolDetail(people[0],expired)).trip.display_status).toBe('EXPIRED');await expect(mutateCarpool(people[1],{action:'apply',id:expired,partySize:1})).rejects.toMatchObject({status:409});
  await mutateCarpool(people[0],{action:'state',id:expired,state:'CANCELLED',version:1});expect((await carpoolDetail(people[0],expired)).trip.status).toBe('CANCELLED');
 });
 it("filters routes/time, creates independently linked support reports and private notifications",async()=>{
  const id=await create();await create({destinationId:places[2]});
  expect((await listCarpools(people[1],{mine:'false',page:0,destination:places[1]})).trips).toHaveLength(1);
  expect((await listCarpools(people[1],{mine:'false',page:0,from:new Date(Date.now()+86400000).toISOString()})).trips).toHaveLength(0);
  expect((await listCarpools(people[1],{mine:'true',page:0})).trips).toHaveLength(0);
  await mutateCarpool(people[1],{action:'apply',id,partySize:1});await mutateCarpool(people[0],{action:'respond',id,userId:people[1].id,accept:false});
  expect((await pool.query("select * from notifications where recipient_id=$1",[people[2].id])).rowCount).toBe(0);
  const ticket=await createSupport(people[1],{category:'carpool',subject:'举报行程问题',body:'行程说明需要客服核实',tripId:id,clientId:randomUUID()});
  const detail=await getSupport(people[1],ticket.id);expect(detail.ticket.trip_id).toBe(id);expect(detail.ticket.order_id).toBeNull();
  await expect(createSupport(people[1],{category:'order',subject:'错误订单关联',body:'不能把行程当订单',orderId:id,clientId:randomUUID()})).rejects.toMatchObject({status:403});
 });
 it("enforces API authentication, admin-only places, origin and numeric chat paging",async()=>{
  current=null;expect((await GET(new Request('http://localhost/api/carpool'))).status).toBe(401);current=people[0];
  const post=(body:unknown,origin='http://localhost')=>POST(new Request('http://localhost/api/carpool',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)}));
  expect((await post(input(),'https://evil.example')).status).toBe(403);expect((await post({action:'place',name:'越权地点',active:true})).status).toBe(403);
  const id=await create();await pool.query("insert into carpool_messages(trip_id,sender_id,body,client_id) select $1,$2,'消息'||n,gen_random_uuid() from generate_series(1,85) n",[id,people[0].id]);
  const first=await carpoolChat(people[0],id),second=await carpoolChat(people[0],id,first.messages[0].id);expect(new Set([...first.messages,...second.messages].map(m=>m.id)).size).toBe(80);
  const after=await carpoolChat(people[0],id,undefined,second.messages[0].id);expect(after.hasMore).toBe(true);
 });
});
