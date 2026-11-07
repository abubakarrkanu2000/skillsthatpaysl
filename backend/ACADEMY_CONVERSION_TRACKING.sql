-- Run AFTER ACADEMY_ADD_TO_EXISTING_STP.sql. Rerunnable; only Academy attribution objects/functions change.
begin;
create table if not exists public.academy_attribution_overrides(
 order_id uuid primary key references public.academy_orders(id),
 event_registration_id uuid references public.stp_registrations(id),
 classification text not null check(classification in ('returning','new')),
 reviewed_by uuid not null references auth.users(id),reviewed_at timestamptz not null default now(),
 check((classification='returning' and event_registration_id is not null) or (classification='new' and event_registration_id is null))
);
create table if not exists public.academy_attribution_audit(
 id bigint generated always as identity primary key,order_id uuid not null references public.academy_orders(id),
 event_registration_id uuid references public.stp_registrations(id),classification text not null,reviewed_by uuid references auth.users(id),created_at timestamptz default now()
);
alter table public.academy_attribution_overrides enable row level security;
alter table public.academy_attribution_audit enable row level security;
revoke all on public.academy_attribution_overrides,public.academy_attribution_audit from anon,authenticated;
create or replace function public.academy_event_match(o public.academy_orders) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare phone_id uuid;email_id uuid;v public.academy_attribution_overrides;candidates jsonb;matched uuid;method text;
begin
 select * into v from public.academy_attribution_overrides where order_id=o.id;
 if found then return jsonb_build_object('type',v.classification,'method','Admin reviewed','event_id',v.event_registration_id,'candidates','[]'::jsonb);end if;
 select id into phone_id from public.stp_registrations where phone=o.phone;
 select id into email_id from public.stp_registrations where lower(email)=lower(o.email);
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.full_name,'phone',r.phone,'email',r.email,'status',r.status)),'[]'::jsonb) into candidates
 from public.stp_registrations r where r.id=phone_id or r.id=email_id or regexp_replace(lower(trim(r.full_name)),'[[:space:]]+',' ','g')=regexp_replace(lower(trim(o.name)),'[[:space:]]+',' ','g');
 if phone_id is not null and email_id is not null and phone_id<>email_id then
  return jsonb_build_object('type','review','method','Phone and email match different people','event_id',null,'candidates',candidates);
 end if;
 matched:=coalesce(phone_id,email_id);
 if matched is not null then
  method:=case when phone_id is not null then 'Exact phone' else 'Exact email' end;
  return jsonb_build_object('type','returning','method',method,'event_id',matched,'candidates',candidates);
 end if;
 if jsonb_array_length(candidates)>0 then return jsonb_build_object('type','review','method','Name match — review required','event_id',null,'candidates',candidates);end if;
 return jsonb_build_object('type','new','method','No event registration match','event_id',null,'candidates','[]'::jsonb);
end;
$$;
revoke all on function public.academy_event_match(public.academy_orders) from public,anon,authenticated;
create or replace function public.academy_admin_orders() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.stp_is_admin() then raise exception 'Administrator access required.';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'reference',o.reference,'product',o.product_id,'name',o.name,'phone',o.phone,'email',o.email,'amount',o.amount,'status',o.status,'created_at',o.created_at,'receipt_sent_at',o.receipt_sent_at,'confirmed_at',o.confirmed_at,'transaction_reference',o.transaction_reference,'public_note',o.public_note,'receipt_path',o.receipt_path,'event_registration_id',m.info->>'event_id','attribution',m.info,'event_name',r.full_name,'event_status',r.status,'attendance_number',r.attendance_number,'notifications',(select coalesce(jsonb_agg(jsonb_build_object('channel',n.channel,'status',n.status)),'[]'::jsonb) from public.academy_notifications n where n.order_id=o.id)) order by o.created_at desc)
 from public.academy_orders o cross join lateral(select public.academy_event_match(o) as info)m left join public.stp_registrations r on r.id=(m.info->>'event_id')::uuid),'[]'::jsonb);
end;
$$;
create or replace function public.academy_admin_conversion_stats() returns jsonb language plpgsql security definer set search_path='' as $$
declare report jsonb;
begin
 if not public.stp_is_admin() then raise exception 'Administrator access required.';end if;
 with classified as(select o.*,public.academy_event_match(o) as match from public.academy_orders o), totals as(
 select count(*) filter(where status='confirmed') as paid_orders,
 count(distinct(match->>'event_id')) filter(where status='confirmed' and match->>'type'='returning') as returning_buyers,
 count(distinct phone) filter(where status='confirmed' and match->>'type'='new') as new_buyers,
 count(*) filter(where match->>'type'='review') as needs_review,
 count(*) filter(where status='confirmed' and match->>'type'='review') as unresolved_paid_orders,
 coalesce(sum(amount) filter(where status='confirmed' and match->>'type'='returning'),0) as returning_revenue,
 coalesce(sum(amount) filter(where status='confirmed' and match->>'type'='new'),0) as new_revenue,
 coalesce(sum(amount) filter(where status='confirmed' and match->>'type'='review'),0) as unresolved_revenue,
 count(distinct(match->>'event_id')) filter(where status='confirmed' and match->>'type'='returning' and exists(select 1 from public.stp_registrations r where r.id=(match->>'event_id')::uuid and r.status='Attended')) as attended_buyers
 from classified)
 select to_jsonb(totals)||jsonb_build_object('event_registrants',(select count(*) from public.stp_registrations),'event_attended',(select count(*) from public.stp_registrations where status='Attended'),'returning_conversion_percent',round(100.0*returning_buyers/nullif((select count(*) from public.stp_registrations),0),2),'attended_conversion_percent',round(100.0*attended_buyers/nullif((select count(*) from public.stp_registrations where status='Attended'),0),2)) into report from totals;
 return report;
end;
$$;
create or replace function public.academy_admin_attribute(p_order_id uuid,p_event_id uuid default null,p_new boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.stp_is_admin() then raise exception 'Administrator access required.';end if;
 if not exists(select 1 from public.academy_orders where id=p_order_id) then raise exception 'Order not found.';end if;
 if p_new and p_event_id is not null then raise exception 'Choose one classification.';end if;
 if not p_new and (p_event_id is null or not exists(select 1 from public.stp_registrations where id=p_event_id)) then raise exception 'Choose a valid event registration.';end if;
 insert into public.academy_attribution_overrides(order_id,event_registration_id,classification,reviewed_by) values(p_order_id,p_event_id,case when p_new then 'new' else 'returning' end,auth.uid())
 on conflict(order_id) do update set event_registration_id=excluded.event_registration_id,classification=excluded.classification,reviewed_by=excluded.reviewed_by,reviewed_at=now();
 insert into public.academy_attribution_audit(order_id,event_registration_id,classification,reviewed_by) values(p_order_id,p_event_id,case when p_new then 'new' else 'returning' end,auth.uid());
end;
$$;
revoke all on function public.academy_admin_orders(),public.academy_admin_conversion_stats(),public.academy_admin_attribute(uuid,uuid,boolean) from public,anon;
grant execute on function public.academy_admin_orders(),public.academy_admin_conversion_stats(),public.academy_admin_attribute(uuid,uuid,boolean) to authenticated;
create or replace function public.academy_admin_find_event(p_query text) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.stp_is_admin() then raise exception 'Administrator access required.';end if;
 if p_query is null or length(trim(p_query))<2 or length(p_query)>120 then return '[]'::jsonb;end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.full_name,'phone',r.phone,'email',r.email,'status',r.status)) from (select id,full_name,phone,email,status from public.stp_registrations where full_name ilike '%'||trim(p_query)||'%' or email ilike '%'||trim(p_query)||'%' or phone ilike '%'||trim(p_query)||'%' order by full_name limit 20)r),'[]'::jsonb);
end;
$$;
revoke all on function public.academy_admin_find_event(text) from public,anon;
grant execute on function public.academy_admin_find_event(text) to authenticated;
notify pgrst,'reload schema';
commit;
