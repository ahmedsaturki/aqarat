create or replace function public.commit_intake_event(p_event_id uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  e intake_events%rowtype;
  p jsonb;
  v jsonb;
  property_id uuid;
  person_id uuid;
  contact_value text;
  normalized_contact text;
  existing_contact_person uuid;
  dedup_property_id uuid;
  job_id uuid;
  canonical text;
  incoming_conf numeric;
begin
  select * into e from public.intake_events where id=p_event_id for update;
  if not found then raise exception 'intake_event_not_found'; end if;
  if e.status='processed' then return jsonb_build_object('ok',true,'already_processed',true,'intake_event_id',e.id); end if;

  p:=coalesce(e.parsed_payload->'property','{}'::jsonb);
  v:=coalesce(e.parsed_payload->'validation','{}'::jsonb);
  incoming_conf:=coalesce((p->>'confidence')::numeric,0);

  if coalesce((v->>'valid')::boolean,false) is false then
    update public.intake_events set status='rejected',error_message=coalesce(v->'errors','[]'::jsonb)::text,updated_at=now() where id=e.id;
    insert into public.audit_events(event_type,entity_type,entity_id,actor_type,actor_id,payload)
    values('intake_rejected','intake_event',e.id,'system','intake-engine',jsonb_build_object('validation',v));
    return jsonb_build_object('ok',false,'status','rejected','intake_event_id',e.id,'validation',v);
  end if;

  canonical := lower(regexp_replace(
    coalesce(p->>'city','') || '|' || coalesce(p->>'property_type','unknown') || '|' || coalesce(p->>'transaction_type','unknown') || '|' ||
    case when nullif(p->>'parcel_number','') is not null then 'parcel:' || p->>'parcel_number'
         else 'fallback:' || coalesce(p->>'district','') || '|' || coalesce(p->>'area_m2','') || '|' || coalesce(p->>'price','') end,
    '\\s+', '', 'g'));

  select pr.id into dedup_property_id
  from public.properties pr
  where pr.canonical_key=canonical
  limit 1;

  if dedup_property_id is null and nullif(p->>'parcel_number','') is not null then
    select pr.id into dedup_property_id
    from public.properties pr
    where lower(coalesce(pr.city,''))=lower(coalesce(p->>'city',''))
      and pr.property_type=coalesce(p->>'property_type','unknown')
      and pr.transaction_type=coalesce(p->>'transaction_type','unknown')::property_transaction_type
      and pr.parcel_number=(p->>'parcel_number')::integer
    limit 1;
  end if;

  if dedup_property_id is null then
    select pr.id into dedup_property_id
    from public.properties pr
    where lower(coalesce(pr.city,''))=lower(coalesce(p->>'city',''))
      and lower(coalesce(pr.district,''))=lower(coalesce(p->>'district',''))
      and pr.property_type=coalesce(p->>'property_type','unknown')
      and pr.transaction_type=coalesce(p->>'transaction_type','unknown')::property_transaction_type
      and (p->>'area_m2') is not null and pr.area_m2=(p->>'area_m2')::numeric
    order by pr.updated_at desc
    limit 1;
  end if;

  if dedup_property_id is not null then
    property_id:=dedup_property_id;
    update public.properties
    set description=coalesce(nullif(p->>'description',''),description),
        title=coalesce(nullif(p->>'title',''),title),
        city=coalesce(nullif(p->>'city',''),city),
        district=coalesce(nullif(p->>'district',''),district),
        neighborhood=coalesce(nullif(p->>'neighborhood',''),neighborhood),
        address=coalesce(nullif(p->>'address',''),address),
        area_m2=coalesce(nullif(p->>'area_m2','')::numeric,area_m2),
        price=coalesce(nullif(p->>'price','')::numeric,price),
        parcel_number=coalesce(nullif(p->>'parcel_number','')::integer,parcel_number),
        installments_clear=coalesce(nullif(p->>'installments_clear','')::boolean,installments_clear),
        canonical_key=canonical,
        features=coalesce(features,'{}'::jsonb) || coalesce(p->'features','{}'::jsonb),
        last_seen_at=now(),updated_at=now(),confidence=greatest(coalesce(confidence,0),incoming_conf)
    where id=property_id;
  else
    insert into public.properties(property_type,transaction_type,status,title,description,city,district,neighborhood,address,latitude,longitude,area_m2,bedrooms,bathrooms,floor,finishing,price,currency,features,confidence,first_seen_at,last_seen_at,parcel_number,installments_clear,canonical_key)
    values(coalesce(p->>'property_type','unknown'),coalesce(p->>'transaction_type','unknown')::property_transaction_type,coalesce(p->>'status','active')::property_status,nullif(p->>'title',''),nullif(p->>'description',''),nullif(p->>'city',''),nullif(p->>'district',''),nullif(p->>'neighborhood',''),nullif(p->>'address',''),nullif(p->>'latitude','')::double precision,nullif(p->>'longitude','')::double precision,nullif(p->>'area_m2','')::numeric,nullif(p->>'bedrooms','')::integer,nullif(p->>'bathrooms','')::integer,nullif(p->>'floor',''),nullif(p->>'finishing',''),nullif(p->>'price','')::numeric,coalesce(nullif(p->>'currency',''),'EGP'),coalesce(p->'features','{}'::jsonb),incoming_conf,now(),now(),nullif(p->>'parcel_number','')::integer,nullif(p->>'installments_clear','')::boolean,canonical)
    returning id into property_id;
  end if;

  for contact_value,normalized_contact in select x->>'value',x->>'normalized_value' from jsonb_array_elements(coalesce(p->'contacts','[]'::jsonb)) x loop
    if normalized_contact is not null and normalized_contact<>'' then
      select c.person_id into existing_contact_person from public.contacts c where c.normalized_value=normalized_contact limit 1;
      if existing_contact_person is null then
        insert into public.people(full_name,role,city,notes,confidence)
        values(nullif(e.parsed_payload->'person'->>'full_name',''),'unknown'::person_role,coalesce(p->>'city','مدينة السادات'),'Created from intake event',incoming_conf)
        returning id into person_id;
      else person_id:=existing_contact_person; end if;
      insert into public.contacts(person_id,contact_type,value,normalized_value,is_primary,verified,confidence)
      values(person_id,'phone',contact_value,normalized_contact,true,false,incoming_conf)
      on conflict(contact_type,normalized_value) do update set value=excluded.value,confidence=greatest(contacts.confidence,excluded.confidence);
      insert into public.property_people(property_id,person_id,relationship,confidence,source_record_id)
      values(property_id,person_id,'seller'::person_role,incoming_conf,null) on conflict do nothing;
    end if;
  end loop;

  insert into public.jobs(job_type,status,priority,payload,available_at,idempotency_key)
  values('google_sheets_projection','queued'::job_status,50,jsonb_build_object('entity_type','property','entity_id',property_id,'intake_event_id',e.id),now(), 'sheets:'||property_id::text||':'||e.id::text)
  on conflict(idempotency_key) do nothing
  returning id into job_id;

  if job_id is null then
    select j.id into job_id from public.jobs j where j.idempotency_key='sheets:'||property_id::text||':'||e.id::text limit 1;
  end if;

  update public.intake_events set status='processed',error_message=null,updated_at=now() where id=e.id;
  insert into public.sync_projections(entity_type,entity_id,projection_type,status,last_error,updated_at)
  values('property',property_id,'google_sheets','pending',null,now())
  on conflict(entity_type,entity_id,projection_type) do update set status='pending',last_error=null,updated_at=now();
  insert into public.audit_events(event_type,entity_type,entity_id,actor_type,actor_id,payload)
  values('intake_committed','property',property_id,'system','intake-engine',jsonb_build_object('intake_event_id',e.id,'job_id',job_id,'canonical_key',canonical));

  return jsonb_build_object('ok',true,'status','processed','intake_event_id',e.id,'property_id',property_id,'job_id',job_id,'canonical_key',canonical);
end;
$function$;
