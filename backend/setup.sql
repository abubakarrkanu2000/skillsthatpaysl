-- Run once in your Supabase SQL Editor. This creates new STP-specific objects.
begin;
create schema if not exists stp_private;
revoke all on schema stp_private from public, anon, authenticated;
create table stp_private.admins (user_id uuid primary key references auth.users(id) on delete cascade);
create table public.stp_settings (
  id boolean primary key default true check (id),
  registration_open boolean not null default true,
  public_capacity integer not null default 50 check(public_capacity >= 0),
  reserved_capacity integer not null default 20 check(reserved_capacity >= 0)
);
insert into public.stp_settings(id) values(true);
create sequence stp_private.attendance_sequence;
create table public.stp_registrations (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check(char_length(btrim(full_name)) between 2 and 120),
  email text check(email is null or (char_length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  phone text check(phone is null or phone ~ '^\+232(25|30|31|32|33|34|35|70|72|73|74|75|76|77|78|79|88)[0-9]{6}$'),
  guest_type text not null default 'Public' check(guest_type in ('Public','Reserved')),
  source text not null default 'Website' check(source in ('Website','Admin')),
  admin_request_id uuid unique,
  notes text not null default '' check(char_length(notes)<=500),
  answers jsonb,
  survey_complete boolean not null default false,
  status text not null default 'Survey incomplete' check(status in ('Survey incomplete','Ready for review','Offered','Confirmed','Waitlisted','Not selected','Declined','Offer expired','Cancelled','Attended')),
  attendance_number text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(source <> 'Website' or (email is not null and phone is not null)),
  check(status not in ('Confirmed','Attended') or attendance_number is not null)
);
create unique index stp_unique_email on public.stp_registrations(lower(email)) where email is not null;
create unique index stp_unique_phone on public.stp_registrations(phone) where phone is not null;
create table stp_private.submission_tokens (
  registration_id uuid primary key references public.stp_registrations(id) on delete cascade,
  token_hash text unique not null
);
create table public.stp_audit_log (
  id bigint generated always as identity primary key,
  registration_id uuid references public.stp_registrations(id),
  admin_id uuid references auth.users(id),
  action text not null,
  old_status text,
  new_status text,
  created_at timestamptz not null default now()
);
alter table public.stp_registrations enable row level security;
alter table public.stp_settings enable row level security;
alter table public.stp_audit_log enable row level security;
revoke all on public.stp_registrations,public.stp_settings,public.stp_audit_log from anon,authenticated;
grant select on public.stp_registrations,public.stp_settings,public.stp_audit_log to authenticated;

create function public.stp_is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from stp_private.admins where user_id=auth.uid()); $$;
create policy stp_admin_read on public.stp_registrations for select to authenticated using(public.stp_is_admin());
create policy stp_admin_settings on public.stp_settings for select to authenticated using(public.stp_is_admin());
create policy stp_admin_audit on public.stp_audit_log for select to authenticated using(public.stp_is_admin());

create function public.stp_register(r_full_name text,r_email text,r_phone text,r_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_hash text;
begin
  if r_token is null or r_token !~ '^[a-f0-9]{64}$' then raise exception 'Invalid submission token'; end if;
  v_hash := encode(sha256(convert_to(r_token,'UTF8')),'hex');
  select registration_id into v_id from stp_private.submission_tokens where token_hash=v_hash;
  if v_id is not null then return v_id; end if;
  if not (select registration_open from public.stp_settings where id) then raise exception 'Registration is closed'; end if;
  if r_email is null or r_phone is null then raise exception 'Email and phone are required'; end if;
  insert into public.stp_registrations(full_name,email,phone)
    values(btrim(r_full_name),lower(btrim(r_email)),r_phone) returning id into v_id;
  insert into stp_private.submission_tokens values(v_id,v_hash);
  return v_id;
exception when unique_violation then
  -- No private registration or submission token is returned to another registrant.
  raise exception 'A registration already exists with these contact details. Please contact the event team.';
end; $$;

create function public.stp_submit_survey(r_id uuid,r_token text,r_answers jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_record public.stp_registrations%rowtype; a jsonb:='{}'; k text; v text; age integer;
begin
  if r_token is null or r_token !~ '^[a-f0-9]{64}$' then raise exception 'Invalid submission token'; end if;
  select r.* into v_record from public.stp_registrations r
    join stp_private.submission_tokens t on t.registration_id=r.id
    where r.id=r_id and t.token_hash=encode(sha256(convert_to(r_token,'UTF8')),'hex') for update of r;
  if not found then raise exception 'Registration session is invalid. Please return to registration.'; end if;
  if not (select registration_open from public.stp_settings where id) then raise exception 'Registration is closed'; end if;
  if v_record.status not in ('Survey incomplete','Ready for review') then raise exception 'Your registration is already under review. Please contact the event team to edit it.'; end if;
  if jsonb_typeof(r_answers) is distinct from 'object' then raise exception 'Invalid survey'; end if;
  foreach k in array array['age','current_situation','skill_interest','skill_income','biggest_obstacle','goal','future_investment','next_expert'] loop
    v := btrim(coalesce(r_answers->>k,''));
    if length(v) not between 1 and 2000 then raise exception 'Please complete every survey answer'; end if;
    a := a || jsonb_build_object(k,v);
  end loop;
  if a->>'age' !~ '^[0-9]{1,3}$' then raise exception 'Enter a valid age'; end if;
  age := (a->>'age')::integer;
  if age not between 17 and 120 then raise exception 'You must be at least 17 to attend'; end if;
  a := jsonb_set(a,'{age}',to_jsonb(age));
  if not (a->>'current_situation'=any(array['Secondary-school student','Secondary-school graduate','University or college student','Graduate','Employed','Freelancer','Business owner','Other'])) then raise exception 'Invalid current situation'; end if;
  if not (a->>'skill_interest'=any(array['Tech & websites','Marketing & branding','Photography & videography','Trading','Other','I’m not sure yet'])) then raise exception 'Invalid skill interest'; end if;
  if not (a->>'skill_income'=any(array['Yes, regularly','Sometimes','Not yet, but I already have a skill','No, I’m still figuring out what to learn'])) then raise exception 'Invalid skill income'; end if;
  if not (a->>'biggest_obstacle'=any(array['I don’t know what skill to learn','I need to improve my skill','I don’t know how to find customers','I don’t know how to sell or market myself','I don’t have enough money or resources to start','I don’t know where to begin','Other'])) then raise exception 'Invalid obstacle'; end if;
  if not (a->>'future_investment'=any(array['Free only','Under NLe 200','NLe 200–350','NLe 351–500','NLe 501–750','NLe 751–1,000','More than NLe 1,000'])) then raise exception 'Invalid investment answer'; end if;
  foreach k in array array['current_situation','skill_interest','biggest_obstacle'] loop
    if a->>k='Other' then
      v := btrim(coalesce(r_answers->>(k||'_other'),''));
      if length(v) not between 1 and 200 then raise exception 'Please describe your Other answer'; end if;
      a := a || jsonb_build_object(k||'_other',v);
    end if;
  end loop;
  update public.stp_registrations set answers=a,survey_complete=true,status='Ready for review',updated_at=now() where id=r_id;
  return true;
end; $$;

create function public.stp_admin_status(r_id uuid,r_status text)
returns public.stp_registrations language plpgsql security definer set search_path = '' as $$
declare rec public.stp_registrations%rowtype; cap integer; used integer; old text;
begin
  if not public.stp_is_admin() then raise exception 'Admin access required'; end if;
  -- Serialize confirmations and capacity changes to prevent competing admins overbooking.
  perform pg_advisory_xact_lock(7348021);
  select * into rec from public.stp_registrations where id=r_id for update;
  if not found then raise exception 'Guest not found'; end if;
  old:=rec.status;
  if r_status is null or r_status<>all(array['Survey incomplete','Ready for review','Offered','Confirmed','Waitlisted','Not selected','Declined','Offer expired','Cancelled','Attended']) then raise exception 'Invalid status'; end if;
  if rec.source='Website' and not rec.survey_complete and r_status not in ('Survey incomplete','Cancelled') then raise exception 'Complete the survey before updating attendance status'; end if;
  if r_status='Survey incomplete' and (rec.survey_complete or rec.source='Admin') then raise exception 'This guest does not have an incomplete survey'; end if;
  if r_status='Attended' and rec.status not in ('Confirmed','Attended') then raise exception 'Confirm the guest before checking them in'; end if;
  if r_status in ('Confirmed','Attended') then
    select case when rec.guest_type='Reserved' then reserved_capacity else public_capacity end into cap from public.stp_settings where id;
    select count(*) into used from public.stp_registrations where guest_type=rec.guest_type and status in ('Confirmed','Attended') and id<>r_id;
    if used>=cap then raise exception '% seat allocation is full',rec.guest_type; end if;
    if rec.attendance_number is null then rec.attendance_number:='STP-'||lpad(nextval('stp_private.attendance_sequence')::text,4,'0'); end if;
  end if;
  update public.stp_registrations set status=r_status,attendance_number=rec.attendance_number,updated_at=now() where id=r_id returning * into rec;
  if old<>r_status then insert into public.stp_audit_log(registration_id,admin_id,action,old_status,new_status) values(r_id,auth.uid(),'Status changed',old,r_status); end if;
  return rec;
end; $$;

create function public.stp_admin_add_guest(r_full_name text,r_email text,r_phone text,r_guest_type text,r_status text,r_notes text,r_request_id uuid default gen_random_uuid())
returns public.stp_registrations language plpgsql security definer set search_path = '' as $$
declare rec public.stp_registrations%rowtype;
begin
  if not public.stp_is_admin() then raise exception 'Admin access required'; end if;
  if r_request_id is null then raise exception 'Guest request ID is required'; end if;
  perform pg_advisory_xact_lock(7348021);
  select * into rec from public.stp_registrations where admin_request_id=r_request_id;
  if found then return rec; end if;
  if r_status is null or r_status<>all(array['Offered','Confirmed','Waitlisted']) then raise exception 'Invalid initial guest status'; end if;
  insert into public.stp_registrations(full_name,email,phone,guest_type,status,source,notes,admin_request_id)
    values(btrim(r_full_name),nullif(lower(btrim(r_email)),''),nullif(r_phone,''),r_guest_type,'Offered','Admin',coalesce(btrim(r_notes),''),r_request_id) returning * into rec;
  insert into public.stp_audit_log(registration_id,admin_id,action,new_status) values(rec.id,auth.uid(),'Guest added','Offered');
  select * into rec from public.stp_admin_status(rec.id,r_status);
  return rec;
exception when unique_violation then raise exception 'A guest with this email or phone already exists';
end; $$;

create function public.stp_admin_registration_open(r_open boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.stp_is_admin() then raise exception 'Admin access required'; end if;
  update public.stp_settings set registration_open=r_open where id;
  insert into public.stp_audit_log(admin_id,action) values(auth.uid(),case when r_open then 'Registration opened' else 'Registration closed' end);
  return r_open;
end; $$;

-- Remove default EXECUTE grants, then expose only the intended functions.
revoke all on function public.stp_is_admin(),public.stp_register(text,text,text,text),public.stp_submit_survey(uuid,text,jsonb),public.stp_admin_status(uuid,text),public.stp_admin_add_guest(text,text,text,text,text,text,uuid),public.stp_admin_registration_open(boolean) from public,anon,authenticated;
grant execute on function public.stp_register(text,text,text,text),public.stp_submit_survey(uuid,text,jsonb) to anon;
grant execute on function public.stp_is_admin(),public.stp_admin_status(uuid,text),public.stp_admin_add_guest(text,text,text,text,text,text,uuid),public.stp_admin_registration_open(boolean) to authenticated;
commit;

-- After creating your admin in Authentication > Users, run the following separately:
-- insert into stp_private.admins(user_id)
-- select id from auth.users where lower(email)=lower('YOUR_ADMIN_EMAIL');
