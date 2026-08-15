# Supabase schema source-of-truth

The production Supabase project is currently migration-managed. The applied migration ledger is kept by Supabase and the repository must never assume an untracked production schema is reproducible from application code alone.

## Applied production migrations (2026-08-15)

- 20260814163031_initial_aqarat_os_schema
- 20260814163330_add_intake_and_queue_contracts
- 20260814164224_add_intake_commit_function
- 20260814164241_fix_intake_commit_relationship_type
- 20260814164306_fix_intake_commit_ambiguous_person_id
- 20260814164938_harden_jobs_and_projection_queue
- 20260814164944_add_job_claim_and_projection_workers
- 20260814180502_harden_functions_and_job_fk_indexes
- 20260814202250_add_discovery_core_contracts
- 20260814204337_add_intelligence_content_review_contracts
- 20260814232012_add_fk_indexes_for_discovery_and_publication
- 20260814232755_complete_discovery_job_result_fields
- 20260814233323_make_discovery_entity_natural_key_upsertable
- 20260815001629_harden_intake_property_identity
- 20260815001714_fix_intake_dedup_and_numeric_parsing
- 20260815001756_repair_duplicate_sadat_land_intake
- 20260815001813_add_job_idempotency_unique_index
- 20260815001829_add_sync_projection_unique_index
- 20260815004002_security_deny_policies_and_index_cleanup
- 20260815004049_add_canonical_property_projection_metadata
- 20260815004645_add_property_resolution_and_lead_scoring
- 20260815004742_fix_lead_score_and_property_match_functions

## Rule

Application code may consume the schema, but it must not become the implicit schema source. Future schema changes must be applied through versioned Supabase migrations and reflected in this repository.

## Current limitation

The production migration ledger is verified, but the original SQL bodies for the historical migrations are not recoverable from the repository connector in this session. Do not fabricate historical SQL. Before a new environment is provisioned, export the authoritative migration SQL from the Supabase project and commit it here.
