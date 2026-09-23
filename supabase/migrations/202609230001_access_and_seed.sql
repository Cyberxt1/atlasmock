alter table public.access_codes add column if not exists metadata jsonb not null default '{}'::jsonb;

create or replace function public.redeem_access_code(raw_code text)
returns table(organization_id uuid, granted_role public.platform_role)
language plpgsql security definer set search_path=''
as $$
declare
  selected public.access_codes;
  display_name text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into selected from public.access_codes
    where code_hash=public.hash_access_code(raw_code)
      and revoked_at is null
      and (expires_at is null or expires_at>now())
      and uses<max_uses
    for update;
  if selected.id is null then raise exception 'Invalid or expired access code'; end if;

  display_name := coalesce(selected.metadata->>'name', case when selected.role='responder' then 'Atlas Responder' else 'Campus User' end);
  insert into public.profiles(id,organization_id,role,full_name)
    values((select auth.uid()),selected.organization_id,selected.role,display_name)
    on conflict(id) do update set organization_id=excluded.organization_id,role=excluded.role,full_name=excluded.full_name;

  if selected.role='responder' then
    insert into public.responders(organization_id,profile_id,unit_code,response_role,team,duty_status)
    values(selected.organization_id,(select auth.uid()),coalesce(selected.metadata->>'unit_code','R-NEW'),coalesce(selected.metadata->>'response_role','General'),coalesce(selected.metadata->>'team','Campus Response Team'),'offline')
    on conflict on constraint responders_organization_id_unit_code_key
    do update set profile_id=excluded.profile_id,response_role=excluded.response_role,team=excluded.team;
  end if;

  update public.access_codes set uses=uses+1 where id=selected.id;
  return query select selected.organization_id,selected.role;
end $$;

insert into public.organizations(id,name,slug,status,contact_email,campus_name)
values('11111111-1111-4111-8111-111111111111','Adeleke University','adeleke-university','active','safety@adelekeuniversity.edu.ng','Ede, Osun State')
on conflict(slug) do update set status='active';

insert into public.geofences(organization_id,name,centre,radius_m)
select id,'Adeleke University Campus',extensions.st_point(4.4625,7.7600)::extensions.geography,1200
from public.organizations where slug='adeleke-university'
and not exists(select 1 from public.geofences g where g.organization_id=organizations.id and g.name='Adeleke University Campus');

insert into public.access_codes(organization_id,code_hash,role,max_uses,metadata)
select id,public.hash_access_code('ADELEKE-4820'),'user',10000,'{"name":"Campus User"}'::jsonb
from public.organizations where slug='adeleke-university'
on conflict(code_hash) do update set revoked_at=null,max_uses=10000;

insert into public.access_codes(organization_id,code_hash,role,max_uses,metadata)
select id,public.hash_access_code('RESP-AU-001'),'responder',50,'{"name":"Adewale Bello","unit_code":"R-001","response_role":"Medical","team":"Medical Team"}'::jsonb
from public.organizations where slug='adeleke-university'
on conflict(code_hash) do update set revoked_at=null,max_uses=50,metadata=excluded.metadata;

grant select on public.organizations to authenticated;
grant select,insert,update on public.profiles,public.responders,public.incidents,public.incident_assignments to authenticated;
grant select on public.geofences,public.points_of_interest to authenticated;
