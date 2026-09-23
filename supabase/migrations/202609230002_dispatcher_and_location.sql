alter table public.incidents add column if not exists latitude double precision;
alter table public.incidents add column if not exists longitude double precision;
alter table public.responders add column if not exists latitude double precision;
alter table public.responders add column if not exists longitude double precision;
alter table public.access_codes add column if not exists responder_id uuid references public.responders(id) on delete cascade;

insert into public.access_codes(organization_id,code_hash,role,max_uses,metadata)
select id,public.hash_access_code('DISPATCH-AU-001'),'dispatcher',25,'{"name":"Adeleke University Dispatcher"}'::jsonb
from public.organizations where slug='adeleke-university'
on conflict(code_hash) do update set revoked_at=null,max_uses=25;

create or replace function public.issue_responder_code(
  responder_name text, responder_email text, responder_phone text,
  responder_role text, responder_team text
) returns table(access_code text, unit_code text, responder_id uuid)
language plpgsql security definer set search_path=''
as $$
declare
  org_id uuid;
  generated_code text;
  generated_unit text;
  created_id uuid;
begin
  select organization_id into org_id from public.profiles
    where id=(select auth.uid()) and role in ('dispatcher','organization_admin');
  if org_id is null then raise exception 'Dispatcher authorization required'; end if;
  generated_code := 'RESP-' || upper(encode(extensions.gen_random_bytes(4),'hex'));
  select 'R-' || lpad((coalesce(max(nullif(regexp_replace(unit_code,'[^0-9]','','g'),'' )::int),0)+1)::text,3,'0')
    into generated_unit from public.responders where organization_id=org_id;
  insert into public.responders(organization_id,unit_code,response_role,team,duty_status,battery)
    values(org_id,generated_unit,responder_role,responder_team,'invited',0) returning id into created_id;
  insert into public.access_codes(organization_id,code_hash,role,responder_id,max_uses,metadata)
    values(org_id,public.hash_access_code(generated_code),'responder',created_id,1,
      jsonb_build_object('name',responder_name,'email',responder_email,'phone',responder_phone,'unit_code',generated_unit,'response_role',responder_role,'team',responder_team));
  return query select generated_code,generated_unit,created_id;
end $$;
grant execute on function public.issue_responder_code(text,text,text,text,text) to authenticated;

create or replace function public.redeem_access_code(raw_code text)
returns table(organization_id uuid, granted_role public.platform_role)
language plpgsql security definer set search_path=''
as $$
declare selected public.access_codes; display_name text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into selected from public.access_codes where code_hash=public.hash_access_code(raw_code)
    and revoked_at is null and (expires_at is null or expires_at>now()) and uses<max_uses for update;
  if selected.id is null then raise exception 'Invalid or expired access code'; end if;
  display_name := coalesce(selected.metadata->>'name',case when selected.role='responder' then 'Atlas Responder' else 'Campus User' end);
  insert into public.profiles(id,organization_id,role,full_name,phone)
    values((select auth.uid()),selected.organization_id,selected.role,display_name,selected.metadata->>'phone')
    on conflict(id) do update set organization_id=excluded.organization_id,role=excluded.role,full_name=excluded.full_name,phone=excluded.phone;
  if selected.role='responder' then
    if selected.responder_id is not null then
      update public.responders set profile_id=(select auth.uid()),duty_status='offline' where id=selected.responder_id;
    else
      insert into public.responders(organization_id,profile_id,unit_code,response_role,team,duty_status)
      values(selected.organization_id,(select auth.uid()),coalesce(selected.metadata->>'unit_code','R-NEW'),coalesce(selected.metadata->>'response_role','General'),coalesce(selected.metadata->>'team','Campus Response Team'),'offline')
      on conflict on constraint responders_organization_id_unit_code_key do update set profile_id=excluded.profile_id,response_role=excluded.response_role,team=excluded.team;
    end if;
  end if;
  update public.access_codes set uses=uses+1 where id=selected.id;
  return query select selected.organization_id,selected.role;
end $$;
