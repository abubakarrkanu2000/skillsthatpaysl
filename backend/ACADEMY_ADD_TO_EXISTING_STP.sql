-- Run this ONE file in your EXISTING STP Supabase SQL editor. Additive, rerunnable.
-- NEW Academy tables only. Does not modify the existing STP event registration schema.
-- Run once in a Supabase SQL editor, then configure admin membership as in SETUP.md.
begin;
select pg_advisory_xact_lock(98204771);
do $$ begin
 if to_regprocedure('public.stp_is_admin()') is null then
  raise exception 'Existing STP admin function is missing. Use the original Skills That Pay project.';
 end if;
end $$;
create or replace function public.academy_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select public.stp_is_admin();
$$;
revoke all on function public.academy_is_admin() from public;
grant execute on function public.academy_is_admin() to anon,authenticated;
create table if not exists public.academy_products(
 id text primary key, amount integer not null check(amount>0), capacity integer not null check(capacity>0), enabled boolean not null default false
);
insert into public.academy_products values ('online-monthly',355,200,false),('live-afternoon',1450,5,false),('live-evening',1450,5,false) on conflict (id) do nothing;
create table if not exists public.academy_orders(
 id uuid primary key default gen_random_uuid(),
 reference text not null unique default ('STP-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
 token_hash text not null unique,
 product_id text not null references public.academy_products(id),
 name text not null check(length(name) between 1 and 100),phone text not null,email text not null,
 amount integer not null check(amount>0),currency text not null default 'SLE' check(currency='SLE'),
 status text not null default 'unpaid' check(status in ('unpaid','pending','confirmed','needs_review','cancelled')),
 created_at timestamptz not null default now(),receipt_sent_at timestamptz,confirmed_at timestamptz,confirmed_by uuid references auth.users(id),
 transaction_reference text,public_note text,
 check(status<>'confirmed' or (confirmed_at is not null and confirmed_by is not null and length(transaction_reference)>0))
);
create unique index if not exists academy_transaction_once on public.academy_orders(lower(transaction_reference)) where transaction_reference is not null;
create unique index if not exists academy_one_active_registration on public.academy_orders(phone,product_id) where status<>'cancelled';
create table if not exists public.academy_payment_audit(id bigint generated always as identity primary key,order_id uuid not null references public.academy_orders(id),actor uuid references auth.users(id),old_status text,new_status text,created_at timestamptz not null default now());
create table if not exists public.academy_notifications(
 id bigint generated always as identity primary key,order_id uuid not null references public.academy_orders(id),
 channel text not null check(channel in ('email','sms')),status text not null default 'pending_setup' check(status in ('pending_setup','queued','sending','sent','failed')),
 created_at timestamptz not null default now(),sent_at timestamptz,provider_reference text,last_error text,
 unique(order_id,channel)
);
alter table public.academy_products enable row level security;
alter table public.academy_orders enable row level security;
alter table public.academy_payment_audit enable row level security;
alter table public.academy_notifications enable row level security;
revoke all on public.academy_products,public.academy_orders,public.academy_payment_audit,public.academy_notifications from anon,authenticated;
alter table public.academy_orders add column if not exists event_registration_id uuid references public.stp_registrations(id) on delete set null;
-- Private status response contains only what a token holder needs. No direct table access.
create or replace function public.academy_order_json(o public.academy_orders) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('reference',o.reference,'name',o.name,'product',case when o.product_id='online-monthly' then 'online-monthly' else 'live-design' end,'group',case when o.product_id='live-afternoon' then '2:00–4:00 p.m.' when o.product_id='live-evening' then '5:00–7:00 p.m.' else null end,'amount',o.amount,'status',o.status,'public_note',o.public_note,'confirmed_at',o.confirmed_at);
$$;
revoke all on function public.academy_order_json(public.academy_orders) from public;
create or replace function public.academy_create_order(p_token text,p_product text,p_group text,p_name text,p_phone text,p_email text) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.academy_orders; product public.academy_products; pid text; th text;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Invalid registration key.'; end if;
 if p_name is null or length(trim(p_name)) not between 1 and 100 or p_phone is null or p_phone !~ '^\+232[1-9][0-9]{7}$' or p_email is null or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Check your name, Sierra Leone phone number and email.'; end if;
 pid:=case when p_product='online-monthly' and p_group is null then 'online-monthly' when p_product='live-design' and p_group='2:00–4:00 p.m.' then 'live-afternoon' when p_product='live-design' and p_group='5:00–7:00 p.m.' then 'live-evening' else null end;
 if pid is null then raise exception 'Choose a valid programme and class group.'; end if;
 th:=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtext(th));
 select * into o from public.academy_orders where token_hash=th;
 if found then
  if o.product_id<>pid or o.name<>trim(p_name) or o.phone<>p_phone or o.email<>lower(trim(p_email)) then raise exception 'This registration already exists. Use its payment status link.'; end if;
  return public.academy_order_json(o);
 end if;
 select * into product from public.academy_products where id=pid;
 if not product.enabled and not public.academy_is_admin() then raise exception 'Registration is not open yet. Please check back soon.'; end if;
 if (select count(*) from public.academy_orders where product_id=pid and status='confirmed')>=product.capacity then raise exception 'This intake is full. Contact us before sending payment.'; end if;
 insert into public.academy_orders(token_hash,product_id,name,phone,email,amount,event_registration_id) values(th,pid,trim(p_name),p_phone,lower(trim(p_email)),product.amount,(select id from public.stp_registrations where phone=p_phone order by created_at desc limit 1)) returning * into o;
 return public.academy_order_json(o);
exception when unique_violation then raise exception 'A registration already exists. Use your saved status link or contact us with your name and phone number.';
end;
$$;
create or replace function public.academy_payment_status(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.academy_orders;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null; end if;
 select * into o from public.academy_orders where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 if not found then return null; end if;
 return public.academy_order_json(o);
end;
$$;
create or replace function public.academy_receipt_sent(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.academy_orders;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Invalid status link.'; end if;
 select * into o from public.academy_orders where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
 if not found then raise exception 'Registration not found.'; end if;
 if o.status in ('unpaid','needs_review') then
  insert into public.academy_payment_audit(order_id,old_status,new_status) values(o.id,o.status,'pending');
  update public.academy_orders set status='pending',receipt_sent_at=now() where id=o.id returning * into o;
 end if;
 return public.academy_order_json(o);
end;
$$;
create or replace function public.academy_admin_orders() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.academy_is_admin() then raise exception 'Administrator access required.'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'reference',o.reference,'product',o.product_id,'name',o.name,'phone',o.phone,'email',o.email,'amount',o.amount,'status',o.status,'created_at',o.created_at,'receipt_sent_at',o.receipt_sent_at,'confirmed_at',o.confirmed_at,'transaction_reference',o.transaction_reference,'public_note',o.public_note,'notifications',(select coalesce(jsonb_agg(jsonb_build_object('channel',n.channel,'status',n.status)),'[]'::jsonb) from public.academy_notifications n where n.order_id=o.id)) order by o.created_at desc) from public.academy_orders o),'[]'::jsonb);
end;
$$;
create or replace function public.academy_admin_review(p_order_id uuid,p_action text,p_transaction text default null,p_note text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.academy_orders; prior text; cap integer;
begin
 if not public.academy_is_admin() then raise exception 'Administrator access required.'; end if;
 if p_action not in ('confirmed','needs_review','cancelled') or p_action is null then raise exception 'Invalid review action.'; end if;
 if length(coalesce(p_note,''))>500 then raise exception 'Keep your note under 500 characters.'; end if;
 select * into o from public.academy_orders where id=p_order_id;
 if not found then raise exception 'Registration not found.'; end if;
 -- Serialize capacity changes within a programme, then lock the order.
 perform pg_advisory_xact_lock(hashtext(o.product_id));
 select * into o from public.academy_orders where id=p_order_id for update;
 prior:=o.status;
 if o.status='confirmed' then
  if p_action='confirmed' then return public.academy_order_json(o); end if;
  raise exception 'Confirmed payments require a separate refund or correction process.';
 end if;
 if o.status='cancelled' then raise exception 'This registration is cancelled.'; end if;
 if p_action='confirmed' then
  if length(trim(coalesce(p_transaction,''))) not between 3 and 120 then raise exception 'Record the verified Orange Money transaction reference.'; end if;
  select capacity into cap from public.academy_products where id=o.product_id;
  if (select count(*) from public.academy_orders where product_id=o.product_id and status='confirmed')>=cap then raise exception 'Capacity reached. Resolve this payment manually before confirming.'; end if;
  update public.academy_orders set status='confirmed',transaction_reference=upper(trim(p_transaction)),confirmed_at=now(),confirmed_by=auth.uid(),public_note=null where id=o.id returning * into o;
  insert into public.academy_notifications(order_id,channel) values(o.id,'email'),(o.id,'sms') on conflict do nothing;
 else
  update public.academy_orders set status=p_action,public_note=nullif(trim(p_note),'') where id=o.id returning * into o;
 end if;
 insert into public.academy_payment_audit(order_id,actor,old_status,new_status) values(o.id,auth.uid(),prior,o.status);
 return public.academy_order_json(o);
exception when unique_violation then raise exception 'That Orange Money transaction has already been used. Check the payment record.';
end;
$$;
revoke all on function public.academy_create_order(text,text,text,text,text,text),public.academy_payment_status(text),public.academy_receipt_sent(text),public.academy_admin_orders(),public.academy_admin_review(uuid,text,text,text) from public;
grant execute on function public.academy_create_order(text,text,text,text,text,text),public.academy_payment_status(text),public.academy_receipt_sent(text) to anon,authenticated;
grant execute on function public.academy_admin_orders(),public.academy_admin_review(uuid,text,text,text) to authenticated;


alter table public.academy_orders add column if not exists receipt_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('academy-receipts','academy-receipts',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict (id) do nothing;
create or replace function public.academy_can_upload_receipt(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select p_path ~ '^[a-f0-9]{64}/[a-f0-9-]{36}\.(jpg|png|webp|pdf)$'
 and exists(select 1 from public.academy_orders o where o.token_hash=encode(sha256(convert_to(split_part(p_path,'/',1),'UTF8')),'hex') and o.status in ('unpaid','pending','needs_review'))
 and (select count(*) from storage.objects where bucket_id='academy-receipts' and split_part(name,'/',1)=split_part(p_path,'/',1))<3;
$$;
revoke all on function public.academy_can_upload_receipt(text) from public;
grant execute on function public.academy_can_upload_receipt(text) to anon,authenticated;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='academy_receipt_insert') then
  create policy academy_receipt_insert on storage.objects for insert to anon,authenticated with check(bucket_id='academy-receipts' and public.academy_can_upload_receipt(name));
 end if;
end $$;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='academy_receipt_admin_read') then
  create policy academy_receipt_admin_read on storage.objects for select to authenticated using(bucket_id='academy-receipts' and public.academy_is_admin());
 end if;
end $$;
-- No public read, update or delete policy. Existing unrelated buckets/policies are not changed.
create or replace function public.academy_attach_receipt(p_token text,p_path text) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.academy_orders; prior text;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' or p_path is null or split_part(p_path,'/',1)<>p_token then raise exception 'Invalid receipt registration.'; end if;
 select * into o from public.academy_orders where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
 if not found then raise exception 'Registration not found.'; end if;
 if o.status in ('confirmed','cancelled') then raise exception 'This registration no longer accepts receipts.'; end if;
 if not exists(select 1 from storage.objects where bucket_id='academy-receipts' and name=p_path) then raise exception 'Receipt upload was not found. Please try again.'; end if;
 prior:=o.status;
 update public.academy_orders set receipt_path=p_path,status='pending',receipt_sent_at=now() where id=o.id returning * into o;
 insert into public.academy_payment_audit(order_id,old_status,new_status) values(o.id,prior,'pending');
 return public.academy_order_json(o);
end;
$$;
revoke all on function public.academy_attach_receipt(text,text) from public;
grant execute on function public.academy_attach_receipt(text,text) to anon,authenticated;

create or replace function public.academy_order_json(o public.academy_orders) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('reference',o.reference,'name',o.name,'product',case when o.product_id='online-monthly' then 'online-monthly' else 'live-design' end,'group',case when o.product_id='live-afternoon' then '2:00–4:00 p.m.' when o.product_id='live-evening' then '5:00–7:00 p.m.' else null end,'amount',o.amount,'status',o.status,'public_note',o.public_note,'confirmed_at',o.confirmed_at,'receipt_uploaded',o.receipt_path is not null);
$$;

create or replace function public.academy_admin_orders() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.academy_is_admin() then raise exception 'Administrator access required.'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'reference',o.reference,'product',o.product_id,'name',o.name,'phone',o.phone,'email',o.email,'amount',o.amount,'status',o.status,'created_at',o.created_at,'receipt_sent_at',o.receipt_sent_at,'confirmed_at',o.confirmed_at,'transaction_reference',o.transaction_reference,'public_note',o.public_note,'receipt_path',o.receipt_path,'event_registration_id',o.event_registration_id,'notifications',(select coalesce(jsonb_agg(jsonb_build_object('channel',n.channel,'status',n.status)),'[]'::jsonb) from public.academy_notifications n where n.order_id=o.id)) order by o.created_at desc) from public.academy_orders o),'[]'::jsonb);
end;
$$;



-- Public product settings contain no learner records. Website reads prices and confirmed availability here.
create or replace function public.academy_public_config() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'amount',p.amount,'capacity',p.capacity,'enabled',p.enabled,'remaining',greatest(0,p.capacity-(select count(*) from public.academy_orders o where o.product_id=p.id and o.status='confirmed')))) from public.academy_products p),'[]'::jsonb));
$$;
revoke all on function public.academy_public_config() from public;
grant execute on function public.academy_public_config() to anon,authenticated;
-- Public settings may be refreshed by customers, but only existing STP admins may open/close registration.
create or replace function public.academy_admin_registration_open(p_open boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.stp_is_admin() then raise exception 'Administrator access required.'; end if;
 update public.academy_products set enabled=p_open;
end;
$$;
revoke all on function public.academy_admin_registration_open(boolean) from public;
grant execute on function public.academy_admin_registration_open(boolean) to authenticated;
create table if not exists public.academy_deployments(version text primary key);
alter table public.academy_deployments enable row level security;
revoke all on public.academy_deployments from anon,authenticated;
do $$ begin
 if not exists(select 1 from public.academy_deployments where version='existing-stp-academy-v1') then
  update public.academy_products set enabled=true;
  insert into public.academy_deployments(version) values('existing-stp-academy-v1');
 end if;
end $$;
notify pgrst, 'reload schema';
commit;
