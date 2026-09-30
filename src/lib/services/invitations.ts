import "server-only";

import type { PoolClient, QueryResultRow } from "pg";
import { maybeOne, query, transaction } from "@/lib/db";
import { siteUrl } from "@/lib/config";

const INVITE_CODE_PATTERN = /^[A-Z2-9]{8}$/;
const STUDENT_ID_PATTERN = /^\d{12}$/;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 30;

type InviteSource = "share_code" | "student_id";

type InvitationProfileRow = {
  id: string;
  display_name: string;
  campus_id: string | null;
  campus_name: string | null;
  verification_status: string;
  status: string;
};

export type InvitationPreview = {
  code: string;
  source: InviteSource;
  inviterId: string;
  maskedName: string;
  campusName: string;
};

export type InvitationResolution =
  | { ok: true; invitation: InvitationPreview }
  | { ok: false; message: string; limited?: boolean };

export class InvitationError extends Error {
  constructor(message = "邀请码无效或暂不可用") {
    super(message);
    this.name = "InvitationError";
  }
}

function normalizeInviteCode(code: string) {
  return code.trim().toUpperCase();
}

function maskDisplayName(name: string) {
  const value = name.trim();
  if (!value) return "校园同学";
  if (value.length === 1) return `${value}*`;
  return `${value.slice(0, 1)}${"*".repeat(Math.min(value.length - 1, 3))}`;
}

function invalidInvitation(): InvitationResolution {
  return { ok: false, message: "邀请码无效或暂不可用" };
}

function runQuery<T extends QueryResultRow = QueryResultRow>(client: PoolClient | undefined, text: string, values: unknown[] = []) {
  return client ? client.query<T>(text, values) : query<T>(text, values);
}

function invitationSiteUrl() {
  const configured = siteUrl.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production" && configured.includes("localhost")) {
    throw new Error("生产环境邀请链接站点地址不能是 localhost，请配置 APP_URL 或 NEXT_PUBLIC_SITE_URL");
  }
  return configured;
}

export function buildInvitationLink(inviteCode: string) {
  const url = new URL("/register", `${invitationSiteUrl()}/`);
  url.searchParams.set("ref", inviteCode);
  return url.toString();
}

export async function applyInvitationRateLimit(rateKey: string) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
  const result = await transaction(async (client) => {
    const current = await client.query<{ attempts: number; window_start: string }>(
      "select attempts, window_start from invitation_rate_limits where rate_key = $1 for update",
      [rateKey]
    );

    if (!current.rows[0]) {
      await client.query(
        "insert into invitation_rate_limits (rate_key, window_start, attempts, updated_at) values ($1, now(), 1, now())",
        [rateKey]
      );
      return { allowed: true };
    }

    const currentWindowStart = new Date(current.rows[0].window_start);
    if (currentWindowStart < windowStart) {
      await client.query(
        "update invitation_rate_limits set window_start = now(), attempts = 1, updated_at = now() where rate_key = $1",
        [rateKey]
      );
      return { allowed: true };
    }

    if (current.rows[0].attempts >= RATE_LIMIT_MAX_ATTEMPTS) return { allowed: false };

    await client.query(
      "update invitation_rate_limits set attempts = attempts + 1, updated_at = now() where rate_key = $1",
      [rateKey]
    );
    return { allowed: true };
  });

  return result.allowed;
}

async function getDefaultCampusId(client?: PoolClient) {
  const campus = await runQuery<{ id: string }>(
    client,
    "select id from campuses where is_active = true and slug = 'ptu' order by created_at asc limit 1"
  );
  if (campus.rows[0]) return campus.rows[0].id;
  const fallback = await runQuery<{ id: string }>(
    client,
    "select id from campuses where is_active = true order by created_at asc limit 1"
  );
  return fallback.rows[0]?.id ?? null;
}

async function findByShareCode(code: string, client?: PoolClient) {
  const result = await runQuery<InvitationProfileRow>(
    client,
    `select p.id, p.display_name, p.campus_id, c.name as campus_name, p.verification_status, p.status
     from profiles p
     left join campuses c on c.id = p.campus_id
     where lower(p.invite_code) = lower($1)
     limit 1`,
    [code]
  );
  return result.rows[0] ?? null;
}

async function findByStudentId(studentId: string, client?: PoolClient) {
  const campusId = await getDefaultCampusId(client);
  if (!campusId) return null;

  const unresolvedConflict = await runQuery<{ id: string }>(
    client,
    "select id from invitation_student_id_conflicts where campus_id = $1 and student_id = $2 and resolved_at is null limit 1",
    [campusId, studentId]
  );
  if (unresolvedConflict.rows[0]) return null;

  const result = await runQuery<InvitationProfileRow>(
    client,
    `select p.id, p.display_name, p.campus_id, c.name as campus_name, p.verification_status, p.status
     from profiles p
     left join campuses c on c.id = p.campus_id
     where p.campus_id = $1 and p.student_id = $2
     order by p.created_at asc
     limit 2`,
    [campusId, studentId]
  );
  if (result.rows.length !== 1) return null;
  return result.rows[0];
}

function toInvitationPreview(code: string, source: InviteSource, row: InvitationProfileRow): InvitationResolution {
  if (row.status !== "active" || row.verification_status !== "verified") return invalidInvitation();
  return {
    ok: true,
    invitation: {
      code,
      source,
      inviterId: row.id,
      maskedName: maskDisplayName(row.display_name),
      campusName: row.campus_name ?? "莆田学院"
    }
  };
}

export async function resolveInvitationCode(rawCode: string, client?: PoolClient): Promise<InvitationResolution> {
  const code = normalizeInviteCode(rawCode);
  if (!code) return invalidInvitation();

  if (INVITE_CODE_PATTERN.test(code)) {
    const row = await findByShareCode(code, client);
    return row ? toInvitationPreview(code, "share_code", row) : invalidInvitation();
  }

  if (STUDENT_ID_PATTERN.test(code)) {
    const row = await findByStudentId(code, client);
    return row ? toInvitationPreview(code, "student_id", row) : invalidInvitation();
  }

  return invalidInvitation();
}

export async function resolveInvitationCodeWithRateLimit(rawCode: string, rateKey: string): Promise<InvitationResolution> {
  const allowed = await applyInvitationRateLimit(rateKey);
  if (!allowed) return { ok: false, message: "操作过于频繁，请稍后再试", limited: true };
  return resolveInvitationCode(rawCode);
}

export async function assignInviteCodeToProfile(client: PoolClient, profileId: string) {
  await client.query("select assign_profile_invite_code($1)", [profileId]);
}

async function wouldCreateCycle(client: PoolClient, inviterId: string, inviteeId: string) {
  const result = await client.query<{ exists: boolean }>(
    `with recursive descendants(id) as (
       select invitee_id from invitation_relationships where inviter_id = $1
       union all
       select r.invitee_id
       from invitation_relationships r
       join descendants d on r.inviter_id = d.id
     )
     select exists(select 1 from descendants where id = $2) as exists`,
    [inviteeId, inviterId]
  );
  return result.rows[0]?.exists ?? false;
}

export async function bindInvitationForNewUser(client: PoolClient, input: { inviteeId: string; code: string }) {
  const resolution = await resolveInvitationCode(input.code, client);
  if (!resolution.ok) throw new InvitationError();

  if (resolution.invitation.inviterId === input.inviteeId) throw new InvitationError();
  if (await wouldCreateCycle(client, resolution.invitation.inviterId, input.inviteeId)) throw new InvitationError();

  const existing = await client.query<{ id: string }>(
    "select id from invitation_relationships where invitee_id = $1 limit 1",
    [input.inviteeId]
  );
  if (existing.rows[0]) throw new InvitationError("该账号已绑定邀请人");

  await client.query(
    `insert into invitation_relationships (inviter_id, invitee_id, source, submitted_code)
     values ($1, $2, $3, $4)`,
    [resolution.invitation.inviterId, input.inviteeId, resolution.invitation.source, resolution.invitation.code]
  );
}

export async function getInvitationDashboard(userId: string, page = 1, pageSize = 10) {
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * pageSize;
  const [profile, invitedCount, invitedUsers, inviter] = await Promise.all([
    maybeOne<{
      id: string;
      display_name: string;
      campus_id: string | null;
      campus_name: string | null;
      invite_code: string | null;
      student_id: string | null;
      verification_status: string;
      status: string;
    }>(
      `select p.id, p.display_name, p.campus_id, c.name as campus_name, p.invite_code, p.student_id, p.verification_status, p.status
       from profiles p left join campuses c on c.id = p.campus_id where p.id = $1`,
      [userId]
    ),
    maybeOne<{ count: number }>(
      "select count(*)::int as count from invitation_relationships where inviter_id = $1",
      [userId]
    ),
    query<{ id: string; display_name: string; created_at: string }>(
      `select p.id, p.display_name, r.created_at
       from invitation_relationships r
       join profiles p on p.id = r.invitee_id
       where r.inviter_id = $1
       order by r.created_at desc
       limit $2 offset $3`,
      [userId, pageSize, offset]
    ),
    maybeOne<{ display_name: string; campus_name: string | null; created_at: string }>(
      `select p.display_name, c.name as campus_name, r.created_at
       from invitation_relationships r
       join profiles p on p.id = r.inviter_id
       left join campuses c on c.id = p.campus_id
       where r.invitee_id = $1`,
      [userId]
    )
  ]);

  const canInvite = profile?.verification_status === "verified" && profile.status === "active";
  return {
    profile,
    canInvite,
    inviteCode: canInvite ? profile?.invite_code ?? null : null,
    studentInviteCode: canInvite ? profile?.student_id ?? null : null,
    inviteLink: canInvite && profile?.invite_code ? buildInvitationLink(profile.invite_code) : null,
    invitedCount: invitedCount?.count ?? 0,
    invitedUsers: invitedUsers.rows.map((user) => ({
      id: user.id,
      maskedName: maskDisplayName(user.display_name),
      createdAt: user.created_at
    })),
    inviter: inviter
      ? {
          maskedName: maskDisplayName(inviter.display_name),
          campusName: inviter.campus_name ?? "莆田学院",
          createdAt: inviter.created_at
        }
      : null,
    page: safePage,
    pageSize
  };
}

export async function getAdminInvitationRelationships(page = 1, pageSize = 50) {
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * pageSize;
  const [count, relationships, conflicts] = await Promise.all([
    maybeOne<{ count: number }>("select count(*)::int as count from invitation_relationships"),
    query<{
      id: string;
      inviter_name: string;
      invitee_name: string;
      source: string;
      submitted_code: string;
      created_at: string;
    }>(
      `select r.id, inviter.display_name as inviter_name, invitee.display_name as invitee_name,
              r.source, r.submitted_code, r.created_at
       from invitation_relationships r
       join profiles inviter on inviter.id = r.inviter_id
       join profiles invitee on invitee.id = r.invitee_id
       order by r.created_at desc
       limit $1 offset $2`,
      [pageSize, offset]
    ),
    query<{ id: string; student_id: string; campus_name: string | null; profile_count: number; detected_at: string }>(
      `select c.id, c.student_id, campuses.name as campus_name,
              cardinality(c.profile_ids)::int as profile_count, c.detected_at
       from invitation_student_id_conflicts c
       left join campuses on campuses.id = c.campus_id
       where c.resolved_at is null
       order by c.detected_at desc
       limit 50`
    )
  ]);

  return {
    count: count?.count ?? 0,
    relationships: relationships.rows,
    conflicts: conflicts.rows,
    page: safePage,
    pageSize
  };
}
