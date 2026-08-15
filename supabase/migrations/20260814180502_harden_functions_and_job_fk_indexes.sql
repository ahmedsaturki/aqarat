-- Harden SECURITY DEFINER / PLpgSQL functions against search_path hijacking.
ALTER FUNCTION public.claim_job(text,text,integer) SET search_path = pg_catalog, public;
ALTER FUNCTION public.requeue_expired_jobs() SET search_path = pg_catalog, public;
ALTER FUNCTION public.set_updated_at() SET search_path = pg_catalog, public;

-- rls_auto_enable is an internal event-trigger helper; it must not be callable through PostgREST.
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM authenticated;

-- Cover foreign keys used in joins / deletes.
CREATE INDEX IF NOT EXISTS idx_content_items_property_id ON public.content_items(property_id);
CREATE INDEX IF NOT EXISTS idx_leads_person_id ON public.leads(person_id);
CREATE INDEX IF NOT EXISTS idx_leads_property_id ON public.leads(property_id);
CREATE INDEX IF NOT EXISTS idx_property_people_source_record_id ON public.property_people(source_record_id);
CREATE INDEX IF NOT EXISTS idx_provenance_source_record_id ON public.provenance(source_record_id);
CREATE INDEX IF NOT EXISTS idx_publications_content_id ON public.publications(content_id);

-- Remove the duplicate unique index; keep the explicitly named *_uidx index.
DROP INDEX IF EXISTS public.sync_projections_entity_projection_uq;
