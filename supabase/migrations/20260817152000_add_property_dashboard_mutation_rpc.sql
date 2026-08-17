create or replace function public.dashboard_numeric_or_null(p_value text, p_field text)
returns numeric
language plpgsql
immutable
as $$
begin
  if p_value is null or btrim(p_value) = '' then return null; end if;
  if p_value !~ '^[0-9]+(\\.[0-9]{1,2})?$' then
    raise exception using errcode = '22023', message = p_field || '_invalid';
  end if;
  return p_value::numeric;
end;
$$;

create or replace function public.dashboard_integer_or_null(p_value text, p_field text)
returns integer
language plpgsql
immutable
as $$
begin
  if p_value is null or btrim(p_value) = '' then return null; end if;
  if p_value !~ '^[0-9]+$' then
    raise exception using errcode = '22023', message = p_field || '_invalid';
  end if;
  return p_value::integer;
end;
$$;

create or replace function public.dashboard_assert_property_keys(p_changes jsonb)
returns void
language plpgsql
immutable
as $$
declare key_name text;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception using errcode = '22023', message = 'property_changes_invalid';
  end if;
  for key_name in select jsonb_object_keys(p_changes) loop
    if key_name not in (
      'property_type','transaction_type','status','title','description','city','district',
      'neighborhood','address','area_m2','bedrooms','bathrooms','floor','finishing',
      'price','currency','features'
    ) then
      raise exception using errcode = '22023', message = 'property_field_not_allowed';
    end if;
  end loop;
end;
$$;

create or replace function public.dashboard_apply_property_mutation(
  p_actor_id text,
  p_action text,
  p_property_id uuid default null,
  p_changes jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  property_row public.properties;
  action_name text := lower(btrim(coalesce(p_action, '')));
  actor_name text := left(btrim(coalesce(p_actor_id, '')), 160);
begin
  if actor_name = '' then raise exception using errcode = '22023', message = 'dashboard_actor_required'; end if;
  if action_name not in ('create','update','archive') then raise exception using errcode = '22023', message = 'property_action_invalid'; end if;
  perform public.dashboard_assert_property_keys(coalesce(p_changes, '{}'::jsonb));

  if action_name = 'create' then
    if coalesce(nullif(btrim(p_changes->>'city'), ''), '') = '' then raise exception using errcode = '22023', message = 'city_required'; end if;
    if coalesce(nullif(btrim(p_changes->>'transaction_type'), ''), '') = '' then raise exception using errcode = '22023', message = 'transaction_type_required'; end if;
    if p_changes->>'transaction_type' not in ('sale','rent','both','unknown') then raise exception using errcode = '22023', message = 'transaction_type_invalid'; end if;
    insert into public.properties (
      property_type, transaction_type, status, title, description, city, district, neighborhood, address,
      area_m2, bedrooms, bathrooms, floor, finishing, price, currency, features
    ) values (
      nullif(btrim(p_changes->>'property_type'), ''),
      (p_changes->>'transaction_type')::public.property_transaction_type,
      coalesce(nullif(p_changes->>'status',''), 'active')::public.property_status,
      nullif(btrim(p_changes->>'title'), ''), nullif(btrim(p_changes->>'description'), ''), btrim(p_changes->>'city'),
      nullif(btrim(p_changes->>'district'), ''), nullif(btrim(p_changes->>'neighborhood'), ''), nullif(btrim(p_changes->>'address'), ''),
      public.dashboard_numeric_or_null(p_changes->>'area_m2', 'area_m2'),
      public.dashboard_integer_or_null(p_changes->>'bedrooms', 'bedrooms'),
      public.dashboard_integer_or_null(p_changes->>'bathrooms', 'bathrooms'),
      nullif(btrim(p_changes->>'floor'), ''), nullif(btrim(p_changes->>'finishing'), ''),
      public.dashboard_numeric_or_null(p_changes->>'price', 'price'), coalesce(nullif(btrim(p_changes->>'currency'), ''), 'EGP'),
      case when p_changes ? 'features' and jsonb_typeof(p_changes->'features') = 'object' then p_changes->'features' else '{}'::jsonb end
    ) returning * into property_row;
  elsif action_name = 'archive' then
    if p_property_id is null then raise exception using errcode = '22023', message = 'property_id_required'; end if;
    update public.properties set status = 'archived' where id = p_property_id returning * into property_row;
    if not found then raise exception using errcode = 'P0002', message = 'property_not_found'; end if;
  else
    if p_property_id is null then raise exception using errcode = '22023', message = 'property_id_required'; end if;
    update public.properties set
      property_type = case when p_changes ? 'property_type' then nullif(btrim(p_changes->>'property_type'), '') else property_type end,
      transaction_type = case when p_changes ? 'transaction_type' then (p_changes->>'transaction_type')::public.property_transaction_type else transaction_type end,
      status = case when p_changes ? 'status' then (p_changes->>'status')::public.property_status else status end,
      title = case when p_changes ? 'title' then nullif(btrim(p_changes->>'title'), '') else title end,
      description = case when p_changes ? 'description' then nullif(btrim(p_changes->>'description'), '') else description end,
      city = case when p_changes ? 'city' then btrim(p_changes->>'city') else city end,
      district = case when p_changes ? 'district' then nullif(btrim(p_changes->>'district'), '') else district end,
      neighborhood = case when p_changes ? 'neighborhood' then nullif(btrim(p_changes->>'neighborhood'), '') else neighborhood end,
      address = case when p_changes ? 'address' then nullif(btrim(p_changes->>'address'), '') else address end,
      area_m2 = case when p_changes ? 'area_m2' then public.dashboard_numeric_or_null(p_changes->>'area_m2', 'area_m2') else area_m2 end,
      bedrooms = case when p_changes ? 'bedrooms' then public.dashboard_integer_or_null(p_changes->>'bedrooms', 'bedrooms') else bedrooms end,
      bathrooms = case when p_changes ? 'bathrooms' then public.dashboard_integer_or_null(p_changes->>'bathrooms', 'bathrooms') else bathrooms end,
      floor = case when p_changes ? 'floor' then nullif(btrim(p_changes->>'floor'), '') else floor end,
      finishing = case when p_changes ? 'finishing' then nullif(btrim(p_changes->>'finishing'), '') else finishing end,
      price = case when p_changes ? 'price' then public.dashboard_numeric_or_null(p_changes->>'price', 'price') else price end,
      currency = case when p_changes ? 'currency' then coalesce(nullif(btrim(p_changes->>'currency'), ''), 'EGP') else currency end,
      features = case when p_changes ? 'features' and jsonb_typeof(p_changes->'features') = 'object' then p_changes->'features' else features end
    where id = p_property_id returning * into property_row;
    if not found then raise exception using errcode = 'P0002', message = 'property_not_found'; end if;
  end if;

  insert into public.audit_events(event_type, entity_type, entity_id, actor_type, actor_id, payload)
  values ('dashboard_property_' || action_name, 'property', property_row.id, 'dashboard_actor', actor_name,
          jsonb_build_object('action', action_name, 'status', property_row.status));
  return jsonb_build_object('ok', true, 'action', action_name, 'property_id', property_row.id, 'status', property_row.status);
end;
$$;

revoke all on function public.dashboard_numeric_or_null(text, text) from public, anon, authenticated;
revoke all on function public.dashboard_integer_or_null(text, text) from public, anon, authenticated;
revoke all on function public.dashboard_assert_property_keys(jsonb) from public, anon, authenticated;
revoke all on function public.dashboard_apply_property_mutation(text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.dashboard_apply_property_mutation(text, text, uuid, jsonb) to service_role;

comment on function public.dashboard_apply_property_mutation(text, text, uuid, jsonb) is 'Atomic property create/update/archive for the authenticated dashboard backend; validates allowlisted fields and writes a bounded audit event.';
