-- Enforce the new verification requirement for previously verified profiles.
update public.profiles
set verification_status = 'unverified'
where verification_status = 'verified'
  and (
    student_id is null
    or student_id !~ '^[0-9]{12}$'
    or phone is null
    or phone !~ '^1[3-9][0-9]{9}$'
  );
