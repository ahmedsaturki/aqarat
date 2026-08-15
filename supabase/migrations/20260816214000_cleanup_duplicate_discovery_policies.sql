-- Remove redundant role-specific deny policies reported by Supabase advisors.
-- The shared deny policy remains active for anon and authenticated roles.
-- service_role is not targeted and retains application access through Supabase.
BEGIN;

DROP POLICY IF EXISTS deny_discovery_permission_evidence_anon
  ON public.discovery_permission_evidence;

DROP POLICY IF EXISTS deny_discovery_permission_evidence_auth
  ON public.discovery_permission_evidence;

COMMIT;
