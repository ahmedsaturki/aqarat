do $$
declare
  canonical uuid := '84dc0bad-73ec-4306-988d-5289b896edfe';
  duplicate uuid := '610d2764-a907-4406-9b6a-e7a120df33dd';
  person uuid;
begin
  update public.properties set
    district='المنطقة 21',
    area_m2=622,
    price=7100000,
    parcel_number=662,
    installments_clear=true,
    canonical_key='مدينة السادات|land|sale|parcel:662',
    description='للبيع قطعة ارض بالمنطقة 21 بمدينة السادات رقم 662 مساحة 622 خالصة الاقساط مطلوب نهائى ٧ مليون ١٠٠ جنية رقم التواصل 01000925451',
    last_seen_at=now(),
    updated_at=now(),
    confidence=greatest(coalesce(confidence,0),0.9)
  where id=canonical;

  select pp.person_id into person from public.property_people pp where pp.property_id=duplicate limit 1;
  if person is not null then
    insert into public.property_people(property_id,person_id,relationship,confidence,source_record_id)
    select canonical,person,relationship,confidence,source_record_id from public.property_people
    where property_id=duplicate
    on conflict do nothing;
  end if;

  update public.jobs set payload=jsonb_set(payload,'{entity_id}',to_jsonb(canonical::text),true), result=jsonb_set(coalesce(result,'{}'::jsonb),'{canonicalized_from}',to_jsonb(duplicate::text),true)
  where payload->>'entity_id'=duplicate::text;

  delete from public.property_people where property_id=duplicate;
  delete from public.properties where id=duplicate;

  update public.intake_events
    set parsed_payload=jsonb_set(parsed_payload,'{property}',
      (parsed_payload->'property') || jsonb_build_object('district','المنطقة 21','area_m2',622,'price',7100000,'parcel_number',662,'installments_clear',true,'confidence',0.9,'unknown_fields',array[]::text[])),
      updated_at=now()
  where id in ('edbf47ff-d3a5-487a-b42a-2dced7be0f85','abea1f5e-f46d-4e46-963b-ad518e5e740a');

  update public.sync_projections
    set status='pending', last_error=null, updated_at=now()
  where entity_type='property' and entity_id=canonical and projection_type='google_sheets';
end $$;
