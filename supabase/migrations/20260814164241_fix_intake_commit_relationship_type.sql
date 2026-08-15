create or replace function public.commit_intake_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
begin
  select * into e from intake_events where id = p_event_id for update;
  if not found then raise exception 'intake_event_not_found'; end if;
  if e.status = 'processed' then
    return jsonb_build_object('ok', true, 'already_processed', true, 'intake_event_id', e.id);
  end if;

  p := coalesce(e.parsed_payload->'property', '{}'::jsonb);
  v := coalesce(e.parsed_payload->'validation', '{}'::jsonb);

  if coalesce((v->>'valid')::boolean, false) is false then
    update intake_events set status='rejected', error_message=coalesce(v->'errors','[]'::jsonb)::text, updated_at=now() where id=e.id;
    insert into audit_events(event_type,entity_type,entity_id,actor_type,actor_id,payload)
    values('intake_rejected','intake_event',e.id,'system','intake-engine',jsonb_build_object('validation',v));
    return jsonb_build_object('ok',false,'status','rejected','intake_event_id',e.id,'validation',v);
  end if;

  select id into dedup_property_id from properties
  where lower(coalesce(city,''))=lower(coalesce(p->>'city',''))
    and lower(coalesce(district,''))=lower(coalesce(p->>'district',''))
    and property_type=coalesce(p->>'property_type','unknown')
    and transaction_type=coalesce(p->>'transaction_type','unknown')::property_transaction_type
    and coalesce(area_m2::text,'')=coalesce(p->>'area_m2','')
    and coalesce(price::text,'')=coalesce(p->>'price','')
    and coalesce(bedrooms::text,'')=coalesce(p->>'bedrooms','')
    and coalesce(bathrooms::text,'')=coalesce(p->>'bathrooms','') limit 1;

  if dedup_property_id is not null then
    property_id:=dedup_property_id;
    update properties set description=coalesce(nullif(p->>'description',''),description), title=coalesce(nullif(p->>'title',''),title), last_seen_at=now(), updated_at=now(), confidence=greatest(coalesce(confidence,0),coalesce((p->>'confidence')::numeric,0)) where id=property_id;
  else
    insert into properties(property_type,transaction_type,status,title,description,city,district,neighborhood,address,latitude,longitude,area_m2,bedrooms,bathrooms,floor,finishing,price,currency,features,confidence,first_seen_at,last_seen_at)
    values(coalesce(p->>'property_type','unknown'),coalesce(p->>'transaction_type','unknown')::property_transaction_type,coalesce(p->>'status','active')::property_status,nullif(p->>'title',''),nullif(p->>'description',''),nullif(p->>'city',''),nullif(p->>'district',''),nullif(p->>'neighborhood',''),nullif(p->>'address',''),nullif(p->>'latitude','')::double precision,nullif(p->>'longitude','')::double precision,nullif(p->>'area_m2','')::numeric,nullif(p->>'bedrooms','')::integer,nullif(p->>'bathrooms','')::integer,nullif(p->>'floor',''),nullif(p->>'finishing',''),nullif(p->>'price','')::numeric,coalesce(nullif(p->>'currency',''),'EGP'),coalesce(p->'features','{}'::jsonb),coalesce((p->>'confidence')::numeric,0),now(),now()) returning id into property_id;
  end if;

  for contact_value,normalized_contact in select x->>'value',x->>'normalized_value' from jsonb_array_elements(coalesce(p->'contacts','[]'::jsonb)) x loop
    if normalized_contact is not null and normalized_contact<>'' then
      select person_id into existing_contact_person from contacts where normalized_value=normalized_contact limit 1;
      if existing_contact_person is null then
        insert into people(full_name,role,city,notes,confidence) values(nullif(e.parsed_payload->'person'->>'full_name',''),'unknown'::person_role,coalesce(p->>'city','مدينة السادات'),'Created from intake event',coalesce((p->>'confidence')::numeric,0)) returning id into person_id;
      else person_id:=existing_contact_person; end if;
      insert into contacts(person_id,contact_type,value,normalized_value,is_primary,verified,confidence) values(person_id,'phone',contact_value,normalized_contact,true,false,coalesce((p->>'confidence')::numeric,0)) on conflict(contact_type,normalized_value) do nothing;
      insert into property_people(property_id,person_id,relationship,confidence,source_record_id) values(property_id,person_id,'seller'::person_role,coalesce((p->>'confidence')::numeric,0),null) on conflict do nothing;
    end if;
  end loop;

  insert into jobs(job_type,status,priority,payload,available_at) values('google_sheets_projection','queued'::job_status,50,jsonb_build_object('entity_type','property','entity_id',property_id,'intake_event_id',e.id),now()) returning id into job_id;
  update intake_events set status='processed',error_message=null,updated_at=now() where id=e.id;
  insert into sync_projections(entity_type,entity_id,projection_type,status) values('property',property_id,'google_sheets','pending') on conflict(entity_type,entity_id,projection_type) do nothing;
  insert into audit_events(event_type,entity_type,entity_id,actor_type,actor_id,payload) values('intake_committed','property',property_id,'system','intake-engine',jsonb_build_object('intake_event_id',e.id,'job_id',job_id));
  return jsonb_build_object('ok',true,'status','processed','intake_event_id',e.id,'property_id',property_id,'job_id',job_id);
end;
$$;
