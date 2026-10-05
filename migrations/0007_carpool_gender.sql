alter table carpool_trips add column if not exists gender_preference text not null default 'ANY'
  check (gender_preference in ('ANY','MALE','FEMALE'));
alter table carpool_members add column if not exists gender_confirmed boolean not null default false;
