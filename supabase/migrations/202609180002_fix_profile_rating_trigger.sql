-- Allow the review rating trigger to update rating/review_count while keeping
-- role, status, and verification_status protected from direct user updates.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
