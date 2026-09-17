-- Campus Runner is single-campus: Putian University only.
-- Campus verification is based on a unique 12-digit student ID.

insert into public.campuses (name, slug, city, is_active)
values ('莆田学院', 'ptu', '莆田', true)
on conflict (slug) do update set
  name = excluded.name,
  city = excluded.city,
  is_active = true;

with target as (
  select id from public.campuses where slug = 'ptu'
)
update public.profiles
set campus_id = target.id
from target
where public.profiles.campus_id is distinct from target.id;

with target as (
  select id from public.campuses where slug = 'ptu'
)
update public.orders
set campus_id = target.id
from target
where public.orders.campus_id is distinct from target.id;

update public.campuses
set is_active = false
where slug <> 'ptu';

-- Clear legacy values that do not satisfy the new verification format.
update public.profiles
set verification_status = 'unverified'
where student_id is not null
  and student_id !~ '^[0-9]{12}$';

update public.profiles
set student_id = null
where student_id is not null
  and student_id !~ '^[0-9]{12}$';

update public.profiles
set phone = null
where phone is not null
  and phone <> ''
  and phone !~ '^1[3-9][0-9]{9}$';

-- Keep only the earliest profile for every duplicated student ID.
with ranked as (
  select id, row_number() over (partition by student_id order by created_at, id) as row_number
  from public.profiles
  where student_id is not null
)
update public.profiles
set student_id = null, verification_status = 'unverified'
from ranked
where public.profiles.id = ranked.id
  and ranked.row_number > 1;

drop index if exists public.profiles_student_id_unique;
create unique index profiles_student_id_unique
on public.profiles (student_id)
where student_id is not null;

alter table public.profiles drop constraint if exists profiles_student_id_format;
alter table public.profiles
add constraint profiles_student_id_format
check (student_id is null or student_id ~ '^[0-9]{12}$');

alter table public.profiles drop constraint if exists profiles_phone_format;
alter table public.profiles
add constraint profiles_phone_format
check (phone is null or phone = '' or phone ~ '^1[3-9][0-9]{9}$');

-- Allow trusted verification functions to update protected profile fields.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.profile_privilege_update', true) = 'true' then
    return new;
  end if;

  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.verification_status is distinct from old.verification_status then
    raise exception '无权修改该资料字段';
  end if;

  return new;
end;
$$;

create or replace function public.submit_verification(p_student_id text, p_phone text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_student_id text := trim(coalesce(p_student_id, ''));
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception '请先登录';
  end if;

  if v_student_id !~ '^[0-9]{12}$' then
    raise exception '学号必须为 12 位数字';
  end if;

  if v_phone is not null and v_phone !~ '^1[3-9][0-9]{9}$' then
    raise exception '手机号格式不正确';
  end if;

  perform set_config('app.profile_privilege_update', 'true', true);

  update public.profiles
  set
    student_id = v_student_id,
    phone = v_phone,
    verification_status = 'pending'
  where id = v_user_id and status = 'active'
  returning * into v_profile;

  if not found then
    raise exception '资料不存在或账号不可用';
  end if;

  return v_profile;
end;
$$;

revoke all on function public.submit_verification(text, text) from public;
grant execute on function public.submit_verification(text, text) to authenticated;
