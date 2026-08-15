create or replace function public.materialize_discovery_entity(p_entity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e discovery_entities%rowtype;
  a jsonb;
  canonical text;
  property_id uuid;
  phone text;
  normalized_phone text;
  person_id uuid;
  tx text;
  status text;
  ptype text;
  area numeric;
  price numeric;
  parcel integer;
  district text;
  city text;
  title text;
  description text;
  confidence numeric;
begin
  select * into e from public.discovery_entities where id=p_entity_id for update;
  if not found then raise exception 'discovery_entity_not_found'; end if;
  if e.entity_type <> 'property' then
    update public.discovery_entities set status='rejected',updated_at=now() where id=e.id;
    return jsonb_build_object('ok',false,'status','rejected','reason','unsupported_entity_type');
  end if;

  a:=coalesce(e.attributes,'{}'::jsonb);
  city:=nullif(e.city,'');
  district:=nullif(a->>'district','');
  ptype:=coalesce(nullif(a->>'property_type',''),'unknown');
  tx:=coalesce(nullif(a->>'transaction_type',''),'unknown');
  if tx not in ('sale','rent','both','unknown') then tx:='unknown'; end if;
  status:='active';
  area:=nullif(a->>'area_m2','')::numeric;
  price:=nullif(a->>'price','')::numeric;
  parcel:=nullif(a->>'parcel_number','')::integer;
  title:=nullif(e.name,'');
  description:=nullif(a->>'description','');
  confidence:=greatest(coalesce(e.confidence,0),0);

  canonical:=lower(regexp_replace(
    coalesce(city,'') || '|' || ptype || '|' || tx || '|' ||
    case when parcel is not null then 'parcel:'||parcel::text else 'fallback:'||coalesce(district,'')||'|'||coalesce(area::text,'')||'|'||coalesce(price::text,'') end,
    '\s+','', 'g'));

  select id into property_id from public.properties where canonical_key=canonical limit 1;

  if property_id is null and parcel is not null then
    select id into property_id from public.properties
    where lower(coalesce(city,''))=lower(coalesce(city,''))
      and property_type=ptype
      and transaction_type=tx::property_transaction_type
      and parcel_number=parcel
    limit 1;
  end if;

  if property_id is null then
    insert into public.properties(property_type,transaction_type,status,title,description,city,district,area_m2,price,currency,features,confidence,first_seen_at,last_seen_at,parcel_number,canonical_key)
    values(ptype,tx::property_transaction_type,status,title,description,city,district,area,price,coalesce(nullif(a->>'currency',''),'EGP'),jsonb_build_object('discovery_entity_id',e.id,'source_url',e.source_url,'ai_generated',coalesce((a->>'ai_generated')::boolean,false)),confidence,now(),now(),parcel,canonical)
    returning id into property_id;
  else
    update public.properties set
      title=coalesce(title,public.properties.title),
      description=coalesce(description,public.properties.description),
      city=coalesce(city,public.properties.city),
      district=coalesce(district,public.properties.district),
      area_m2=coalesce(area,public.properties.area_m2),
      price=coalesce(price,public.properties.price),
      currency=coalesce(nullif(a->>'currency',''),public.properties.currency),
      parcel_number=coalesce(parcel,public.properties.parcel_number),
      canonical_key=canonical,
      features=coalesce(public.properties.features,'{}'::jsonb) || jsonb_build_object('discovery_entity_id',e.id,'source_url',e.source_url,'ai_generated',coalesce((a->>'ai_generated')::boolean,false)),
      confidence=greatest(coalesce(public.properties.confidence,0),confidence),
      last_seen_at=now(),updated_at=now()
    where id=property_id;
  end if;

  phone:=nullif(e.phone,'');
  normalized_phone:=phone;
  if phone is not null then
    normalized_phone:=case
      when phone like '+%' then phone
      when phone like '01%' then '+20'||substring(phone from 2)
      when phone like '201%' then '+'||phone
      else phone
    end;
    select c.person_id into person_id from public.contacts c where c.normalized_value=normalized_phone limit 1;
    if person_id is null then
      insert into public.people(full_name,role,city,notes,confidence)
      values(null,'unknown'::person_role,city,'Created from discovery entity',confidence)
      returning id into person_id;
    end if;
    insert into public.contacts(person_id,contact_type,value,normalized_value,is_primary,verified,confidence)
    values(person_id,'phone',phone,normalized_phone,true,false,confidence)
    on conflict(contact_type,normalized_value) do update set confidence=greatest(public.contacts.confidence,excluded.confidence);
    insert into public.property_people(property_id,person_id,relationship,confidence,source_record_id)
    values(property_id,person_id,case when tx='sale' then 'seller'::person_role else 'agent'::person_role end,confidence,null)
    on conflict do nothing;
  end if;

  insert into public.provenance(entity_type,entity_id,field_name,observed_value,source_record_id,evidence,confidence)
  select 'property',property_id,k,v,e.source_record_id, jsonb_build_object('discovery_entity_id',e.id,'source_url',e.source_url), confidence
  from jsonb_each_text(jsonb_build_object(
    'city',city,
    'district',district,
    'property_type',ptype,
    'transaction_type',tx,
    'area_m2',area::text,
    'price',price::text,
    'parcel_number',parcel::text
  )) x(k,v)
  where v is not null
  on conflict do nothing;

  update public.discovery_entities
  set status='materialized',updated_at=now(),attributes=coalesce(attributes,'{}'::jsonb)||jsonb_build_object('property_id',property_id,'materialized_at',now())
  where id=e.id;

  return jsonb_build_object('ok',true,'status','materialized','property_id',property_id,'discovery_entity_id',e.id,'canonical_key',canonical,'person_id',person_id);
end;
$$;
revoke all on function public.materialize_discovery_entity(uuid) from public, anon, authenticated;
grant execute on function public.materialize_discovery_entity(uuid) to service_role;
