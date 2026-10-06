alter table carpool_members drop constraint if exists carpool_members_status_check;
alter table carpool_members
  add constraint carpool_members_status_check check(status in ('PENDING','PAYMENT_PENDING','APPROVED','REJECTED','LEFT'));

alter table carpool_members add column if not exists paid_at timestamptz;
alter table carpool_members add column if not exists service_fee_cents integer not null default 0 check(service_fee_cents >= 0);

update carpool_members
set paid_at = coalesce(paid_at, created_at)
where status = 'APPROVED' and paid_at is null;
