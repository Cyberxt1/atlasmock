create extension if not exists pgcrypto;
create extension if not exists postgis with schema extensions;

create type public.platform_role as enum ('super_admin','organization_admin','dispatcher','responder','user');
create type public.organization_status as enum ('trial','active','suspended');
create type public.incident_status as enum ('new','acknowledged','assigned','en_route','on_scene','resolved','cancelled');

create table public.organizations (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  status public.organization_status not null default 'trial', contact_email text not null,
  campus_name text not null, created_at timestamptz not null default now()
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  role public.platform_role not null, full_name text not null, phone text,
  created_at timestamptz not null default now()
);
create table public.access_codes (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  code_hash text not null unique, role public.platform_role not null,
  responder_profile_id uuid references public.profiles(id) on delete cascade,
  expires_at timestamptz, max_uses integer not null default 1, uses integer not null default 0,
  revoked_at timestamptz, created_at timestamptz not null default now()
);
create table public.geofences (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, centre extensions.geography(point,4326) not null, radius_m integer not null check(radius_m between 50 and 100000),
  active boolean not null default true, created_at timestamptz not null default now()
);
create index geofences_centre_idx on public.geofences using gist(centre);
create table public.points_of_interest (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, category text not null, location extensions.geography(point,4326) not null,
  created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
create index poi_location_idx on public.points_of_interest using gist(location);
create table public.responders (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid unique references public.profiles(id) on delete set null, unit_code text not null,
  response_role text not null, team text not null, duty_status text not null default 'offline',
  last_location extensions.geography(point,4326), battery integer, updated_at timestamptz not null default now(),
  unique(organization_id,unit_code)
);
create index responders_location_idx on public.responders using gist(last_location);
create table public.incidents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  reference text not null, reporter_id uuid references public.profiles(id), category text not null, severity text not null,
  title text not null, description text, location_name text not null, location extensions.geography(point,4326),
  status public.incident_status not null default 'new', created_at timestamptz not null default now(), resolved_at timestamptz,
  unique(organization_id,reference)
);
create index incidents_org_status_idx on public.incidents(organization_id,status,created_at desc);
create index incidents_location_idx on public.incidents using gist(location);
create table public.incident_assignments (
  incident_id uuid references public.incidents(id) on delete cascade,
  responder_id uuid references public.responders(id) on delete cascade,
  assigned_by uuid references public.profiles(id), assigned_at timestamptz not null default now(),
  primary key(incident_id,responder_id)
);

create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=(select auth.uid()) and role='super_admin')
$$;
create or replace function public.current_organization_id() returns uuid language sql stable security definer set search_path='' as $$
  select organization_id from public.profiles where id=(select auth.uid())
$$;
create or replace function public.has_platform_role(allowed public.platform_role[]) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=(select auth.uid()) and role=any(allowed))
$$;
create or replace function public.hash_access_code(raw_code text) returns text language sql immutable set search_path='' as $$
  select pg_catalog.encode(extensions.digest(upper(pg_catalog.btrim(raw_code)), 'sha256'::text), 'hex')
$$;
create or replace function public.redeem_access_code(raw_code text) returns table(organization_id uuid, granted_role public.platform_role) language plpgsql security definer set search_path='' as $$
declare selected public.access_codes;
begin
 select * into selected from public.access_codes where code_hash=public.hash_access_code(raw_code) and revoked_at is null and (expires_at is null or expires_at>now()) and uses<max_uses for update;
 if selected.id is null then raise exception 'Invalid or expired access code'; end if;
 update public.access_codes set uses=uses+1 where id=selected.id;
 return query select selected.organization_id,selected.role;
end $$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.access_codes enable row level security;
alter table public.geofences enable row level security;
alter table public.points_of_interest enable row level security;
alter table public.responders enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_assignments enable row level security;

revoke all on all tables in schema public from anon,authenticated;
grant select,insert,update,delete on public.organizations,public.profiles,public.access_codes,public.geofences,public.points_of_interest,public.responders,public.incidents,public.incident_assignments to authenticated;
grant execute on function public.redeem_access_code(text) to anon,authenticated;

create policy organizations_select on public.organizations for select to authenticated using(public.is_super_admin() or id=public.current_organization_id());
create policy organizations_admin_all on public.organizations for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
create policy profiles_tenant_select on public.profiles for select to authenticated using(public.is_super_admin() or organization_id=public.current_organization_id() or id=(select auth.uid()));
create policy profiles_tenant_update on public.profiles for update to authenticated using(public.is_super_admin() or id=(select auth.uid()) or (organization_id=public.current_organization_id() and public.has_platform_role(array['organization_admin','dispatcher']::public.platform_role[])));
create policy access_codes_admin_all on public.access_codes for all to authenticated using(public.is_super_admin() or (organization_id=public.current_organization_id() and public.has_platform_role(array['organization_admin','dispatcher']::public.platform_role[]))) with check(public.is_super_admin() or organization_id=public.current_organization_id());
create policy geofences_tenant_select on public.geofences for select to authenticated using(public.is_super_admin() or organization_id=public.current_organization_id());
create policy geofences_admin_all on public.geofences for all to authenticated using(public.is_super_admin() or organization_id=public.current_organization_id()) with check(public.is_super_admin() or organization_id=public.current_organization_id());
create policy poi_tenant_all on public.points_of_interest for all to authenticated using(public.is_super_admin() or organization_id=public.current_organization_id()) with check(public.is_super_admin() or organization_id=public.current_organization_id());
create policy responders_tenant_all on public.responders for all to authenticated using(public.is_super_admin() or organization_id=public.current_organization_id()) with check(public.is_super_admin() or organization_id=public.current_organization_id());
create policy incidents_tenant_all on public.incidents for all to authenticated using(public.is_super_admin() or organization_id=public.current_organization_id()) with check(public.is_super_admin() or organization_id=public.current_organization_id());
create policy assignments_tenant_all on public.incident_assignments for all to authenticated using(public.is_super_admin() or exists(select 1 from public.incidents i where i.id=incident_id and i.organization_id=public.current_organization_id())) with check(public.is_super_admin() or exists(select 1 from public.incidents i where i.id=incident_id and i.organization_id=public.current_organization_id()));

alter publication supabase_realtime add table public.incidents,public.responders,public.incident_assignments;
