# Aqarat Goal Alignment

This document is the standing guardrail for the original Aqarat mission.

## Core mission

Build a Sadat City real-estate intelligence and growth system that can ingest property and people signals, resolve duplicates, preserve provenance, score opportunities, generate high-converting marketing assets, route content through review, and distribute through owned and human-assisted channels.

## Non-negotiable internal capabilities

- Property discovery and continuous update.
- People, brokers, offices, buyers, sellers, and contacts as linked entities.
- Canonical entity resolution: the same property/person/contact must not become duplicate records merely because the wording or sender differs.
- Provenance and evidence for important facts.
- Lead and intent intelligence without exposing internal scores or private source data publicly.
- Supabase/Postgres as source of truth.
- Google Sheets as an operational projection, not the source of truth.

## Public marketing contract

Public content is a sales and marketing asset, not a database dump.

Public content may use verified property facts needed for the sales story, but must not expose owner, broker, office, seller, source, sender, chat, internal IDs, or private contact data. Public CTAs use Lara Real Estate Marketing's configured public contact details only.

## Growth strategy contract

Every piece of content should be selected for an audience, funnel stage, and evidence-backed marketing angle. The system should optimize for qualified conversations and conversions rather than raw impressions.

Allowed strategic devices include benefit framing, proof, comparison, objection handling, risk reduction, local expertise, clear next steps, and channel-native formats.

Disallowed devices include fake scarcity, fabricated social proof, fabricated urgency, guaranteed outcomes without evidence, deceptive bait-and-switch, privacy leakage, and discriminatory targeting.

## Original roadmap guardrails

1. Intake reliability.
2. Discovery coverage.
3. Entity resolution.
4. People and interest graph.
5. Lead scoring.
6. Content factory and marketing intelligence.
7. Review and approval.
8. Owned-channel publishing.
9. Human-assisted external distribution.
10. Measurement and continuous optimization.
11. Browser fallback only where HTTP is insufficient.
12. Scale only after the preceding layer is tested.
