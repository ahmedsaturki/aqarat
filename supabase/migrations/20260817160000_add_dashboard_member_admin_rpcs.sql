-- Aqarat RBAC member administration contracts.
-- Additive only: no existing rows are deleted or rewritten.

create or replace function public.dashboard_list_members(p_workspace_id uuid)
returns table (
  id uuid,
  workspace_id uuid,
  auth_user_id uuid,
  email text,
  role text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  last_seen_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  select m.id, m.workspace_id, m.auth_user_id, u.email, m.role, m.status,
         m.created_at, m.updated_at, m.last_seen_at
    from public.dashboard_members m
    left join auth.users u on u.id = m.auth_user_id
   where m.workspace_id = p_workspace_id
   order by m.created_at asc
   limit 500;
$$;

create or replace function public.dashboard_create_invitation(
  p_workspace_id uuid,
  p_email text,
  p_role text,
  p_token_digest text,
  p_expires_at timestamptz,
  p_invited_by uuid
)
returns table (id uuid, workspace_id uuid, email text, role text, expires_at timestamptz, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(p_email));
  normalized_role text := lower(trim(p_role));
  invitation_id uuid;
begin
  if p_workspace_id is null or p_invited_by is null then raise exception 'dashboard_invitation_context_invalid'; end if;
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'dashboard_invitation_email_invalid'; end if;
  if normalized_role not in ('admin','operator','analyst','viewer') then raise exception 'dashboard_invitation_role_invalid'; end if;
  if length(coalesce(p_token_digest, '')) < 32 or length(p_token_digest) > 128 then raise exception 'dashboard_invitation_digest_invalid'; end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '7 days' then raise exception 'dashboard_invitation_expiry_invalid'; end if;

  insert into public.dashboard_invitations(workspace_id, email, role, token_digest, invited_by, expires_at)
  values (p_workspace_id, normalized_email, normalized_role, p_token_digest, p_invited_by, p_expires_at)
  returning dashboard_invitations.id into invitation_id;

  return query
  select i.id, i.workspace_id, i.email, i.role, i.expires_at, i.created_at
    from public.dashboard_invitations i
   where i.id = invitation_id;
end;
$$;

create or replace function public.dashboard_update_member(
  p_workspace_id uuid,
  p_member_id uuid,
  p_role text default null,
  p_status text default null
)
returns table (id uuid, workspace_id uuid, auth_user_id uuid, role text, status text, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_role text := nullif(lower(trim(p_role)), '');
  normalized_status text := nullif(lower(trim(p_status)), '');
begin
  if p_workspace_id is null or p_member_id is null then raise exception 'dashboard_member_context_invalid'; end if;
  if normalized_role is not null and normalized_role not in ('owner','admin','operator','analyst','viewer') then raise exception 'dashboard_member_role_invalid'; end if;
  if normalized_status is not null and normalized_status not in ('active','suspended','removed') then raise exception 'dashboard_member_status_invalid'; end if;
  if normalized_role is null and normalized_status is null then raise exception 'dashboard_member_no_change'; end if;

  update public.dashboard_members m
     set role = coalesce(normalized_role, m.role),
         status = coalesce(normalized_status, m.status),
         updated_at = now()
   where m.id = p_member_id and m.workspace_id = p_workspace_id
   returning m.id, m.workspace_id, m.auth_user_id, m.role, m.status, m.updated_at;

  if not found then raise exception 'dashboard_member_not_found'; end if;
end;
$$;

create or replace function public.dashboard_revoke_member_sessions(p_workspace_id uuid, p_auth_user_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  with revoked as (
    update public.dashboard_sessions
       set revoked_at = coalesce(revoked_at, now())
     where workspace_id = p_workspace_id
       and auth_user_id = p_auth_user_id
       and revoked_at is null
    returning 1
  ) select count(*)::integer from revoked;
$$;

revoke all on function public.dashboard_list_members(uuid) from public, anon, authenticated;
revoke all on function public.dashboard_create_invitation(uuid,text,text,text,timestamptz,uuid) from public, anon, authenticated;
revoke all on function public.dashboard_update_member(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.dashboard_revoke_member_sessions(uuid,uuid) from public, anon, authenticated;
grant execute on function public.dashboard_list_members(uuid) to service_role;
grant execute on function public.dashboard_create_invitation(uuid,text,text,text,timestamptz,uuid) to service_role;
grant execute on function public.dashboard_update_member(uuid,uuid,text,text) to service_role;
grant execute on function public.dashboard_revoke_member_sessions(uuid,uuid) to service_role;

comment on function public.dashboard_list_members(uuid) is 'Bounded member listing for the authenticated dashboard control plane; application must enforce manage/read permissions.';
comment on function public.dashboard_create_invitation(uuid,text,text,text,timestamptz,uuid) is 'Stores invitation digest only; raw token is never accepted by the database.';
comment on function public.dashboard_update_member(uuid,uuid,text,text) is 'Scoped additive member role/status update; application must enforce role-management permission.';
comment on function public.dashboard_revoke_member_sessions(uuid,uuid) is 'Revokes all active application sessions for one workspace member.';
