create extension if not exists pgcrypto;

create table if not exists invitation_student_id_conflicts (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid not null references campuses(id) on delete cascade,
  student_id text not null,
  profile_ids uuid[] not null,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (campus_id, student_id)
);

alter table profiles add column if not exists invite_code text;

do $$ begin
  alter table profiles add constraint profiles_invite_code_format
    check (invite_code is null or invite_code ~ '^[A-Z2-9]{8}$');
exception when duplicate_object then null; end $$;

create unique index if not exists profiles_invite_code_unique_idx
  on profiles (lower(invite_code))
  where invite_code is not null;

create or replace function generate_invite_code(length integer default 8)
returns text language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  output text := '';
  byte_value integer;
begin
  for i in 1..length loop
    byte_value := get_byte(gen_random_bytes(1), 0);
    output := output || substr(alphabet, (byte_value % char_length(alphabet)) + 1, 1);
  end loop;
  return output;
end;
$$;

create or replace function assign_profile_invite_code(profile_id uuid)
returns text language plpgsql as $$
declare
  candidate text;
begin
  loop
    candidate := generate_invite_code(8);
    begin
      update profiles
      set invite_code = candidate, updated_at = now()
      where id = profile_id and invite_code is null;

      if found then
        return candidate;
      end if;

      select invite_code into candidate from profiles where id = profile_id;
      return candidate;
    exception when unique_violation then
      -- Retry on rare random code collision.
    end;
  end loop;
end;
$$;

select assign_profile_invite_code(id) from profiles where invite_code is null;

insert into invitation_student_id_conflicts (campus_id, student_id, profile_ids, detected_at)
select campus_id, student_id, array_agg(id order by created_at), now()
from profiles
where verification_status = 'verified'
  and campus_id is not null
  and student_id is not null
  and student_id <> ''
group by campus_id, student_id
having count(*) > 1
on conflict (campus_id, student_id) do update
set profile_ids = excluded.profile_ids,
    detected_at = now(),
    resolved_at = null;

create table if not exists invitation_relationships (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references profiles(id) on delete restrict,
  invitee_id uuid not null references profiles(id) on delete cascade,
  source text not null check (source in ('share_code', 'student_id')),
  submitted_code text not null,
  created_at timestamptz not null default now(),
  check (inviter_id <> invitee_id),
  unique (invitee_id)
);

create index if not exists invitation_relationships_inviter_created_idx
  on invitation_relationships (inviter_id, created_at desc);

create index if not exists invitation_relationships_created_idx
  on invitation_relationships (created_at desc);

create table if not exists invitation_rate_limits (
  rate_key text primary key,
  window_start timestamptz not null,
  attempts integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists invitation_rate_limits_updated_idx
  on invitation_rate_limits (updated_at);
