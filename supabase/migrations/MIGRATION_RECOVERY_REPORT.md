# Supabase Migration Recovery Report

- Source: `supabase_migrations.schema_migrations` exported on 2026-08-15.
- Total migration records: 27.
- Restored files: 26.
- Conflicting pre-existing files preserved: 0.

## Restored

- `20260814163031_initial_aqarat_os_schema.sql`
- `20260814163330_add_intake_and_queue_contracts.sql`
- `20260814164224_add_intake_commit_function.sql`
- `20260814164241_fix_intake_commit_relationship_type.sql`
- `20260814164306_fix_intake_commit_ambiguous_person_id.sql`
- `20260814164938_harden_jobs_and_projection_queue.sql`
- `20260814164944_add_job_claim_and_projection_workers.sql`
- `20260814180502_harden_functions_and_job_fk_indexes.sql`
- `20260814202250_add_discovery_core_contracts.sql`
- `20260814204337_add_intelligence_content_review_contracts.sql`
- `20260814232012_add_fk_indexes_for_discovery_and_publication.sql`
- `20260814232755_complete_discovery_job_result_fields.sql`
- `20260814233323_make_discovery_entity_natural_key_upsertable.sql`
- `20260815001629_harden_intake_property_identity.sql`
- `20260815001714_fix_intake_dedup_and_numeric_parsing.sql`
- `20260815001756_repair_duplicate_sadat_land_intake.sql`
- `20260815001813_add_job_idempotency_unique_index.sql`
- `20260815001829_add_sync_projection_unique_index.sql`
- `20260815004002_security_deny_policies_and_index_cleanup.sql`
- `20260815004049_add_canonical_property_projection_metadata.sql`
- `20260815004645_add_property_resolution_and_lead_scoring.sql`
- `20260815004742_fix_lead_score_and_property_match_functions.sql`
- `20260815110409_add_discovery_entity_materializer.sql`
- `20260815133522_add_release_governance_audit_and_source_permission_evidence.sql`
- `20260815141109_enforce_discovery_permissions_and_dashboard_audit.sql`
- `20260815141321_lock_dashboard_apply_action.sql`

## Resolution

- `20260815033252_add_market_graph_interactions_and_content_analytics.sql` differed from a local reproducibility mirror. The mirror was removed from the migration path and the original production-recorded statement was retained.

> The recovered files are the original SQL statements recorded by the database migration system. Where a local mirror differed, the production-recorded statement was selected as the schema source of truth after comparison.
