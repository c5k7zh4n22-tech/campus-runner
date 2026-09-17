-- Campus verification requires both a unique 12-digit student ID and a valid phone number.
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

  if v_phone is null or v_phone !~ '^1[3-9][0-9]{9}$' then
    raise exception '手机号必须为有效的 11 位号码';
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

create or replace function public.admin_review_verification(
  p_user_id uuid,
  p_status public.verification_status
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception '无管理员权限';
  end if;

  if p_status not in ('verified', 'rejected', 'unverified') then
    raise exception '认证状态不合法';
  end if;

  if p_status = 'verified' then
    select * into v_profile from public.profiles where id = p_user_id;
    if not found then
      raise exception '用户不存在';
    end if;
    if v_profile.student_id is null or v_profile.student_id !~ '^[0-9]{12}$' then
      raise exception '用户尚未提交有效的 12 位学号';
    end if;
    if v_profile.phone is null or v_profile.phone !~ '^1[3-9][0-9]{9}$' then
      raise exception '用户尚未提交有效手机号';
    end if;
  end if;

  update public.profiles
  set verification_status = p_status
  where id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception '用户不存在';
  end if;
  return v_profile;
end;
$$;

revoke all on function public.submit_verification(text, text) from public;
revoke all on function public.admin_review_verification(uuid, public.verification_status) from public;
grant execute on function public.submit_verification(text, text) to authenticated;
grant execute on function public.admin_review_verification(uuid, public.verification_status) to authenticated;
