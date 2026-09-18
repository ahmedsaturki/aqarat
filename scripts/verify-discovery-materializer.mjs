import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const migration = readFileSync(
  join(root, 'supabase/migrations/20260918175500_finalize_discovery_entity_materializer_provenance_select.sql'),
  'utf8',
);

const required = [
  "v_city text;",
  "where lower(coalesce(public.properties.city,''))=lower(coalesce(v_city,''))",
  "status::property_status",
  "from jsonb_each(jsonb_build_object(",
  "insert into public.provenance(entity_type,entity_id,field_name,observed_value,source_record_id,confidence)",
  "select 'property',property_id,k,v,null::uuid, confidence",
  "revoke all on function public.materialize_discovery_entity(uuid) from public, anon, authenticated;",
  "grant execute on function public.materialize_discovery_entity(uuid) to service_role;",
];

const forbidden = [
  "coalesce(city,'')=lower(coalesce(city,''))",
  "e.source_record_id",
  ",evidence,confidence)",
  "jsonb_each_text(",
  "v_city,district,area_m2",
];

for (const token of required) {
  if (!migration.includes(token)) {
    throw new Error(`MATERIALIZER_CONTRACT_MISSING:${token}`);
  }
}

for (const token of forbidden) {
  if (migration.includes(token)) {
    throw new Error(`MATERIALIZER_CONTRACT_FORBIDDEN:${token}`);
  }
}

console.log('Discovery materializer contract: PASS');
