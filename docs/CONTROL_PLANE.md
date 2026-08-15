# Aqarat OS Control Plane

The system now treats the dashboard as a first-class operations surface rather than a reporting page.

## Public identity

All public marketing is rendered under one configurable brand identity:

- `PUBLIC_MARKETING_BRAND`
- `PUBLIC_MARKETING_PHONE`
- `PUBLIC_MARKETING_WHATSAPP`
- `PUBLIC_MARKETING_WEBSITE`

The current default identity is Lara Real Estate Marketing with `01000925451` for phone/WhatsApp. Switching to another company or office is a configuration change, not a code rewrite.

## Privacy and publication contract

The canonical entity may retain internal fields such as seller contact details, source identity and asking price. Public marketing context must not contain those fields.

**Price is an internal intelligence field. It is never published in public marketing copy, ads, captions, public Telegram/WhatsApp content, website marketing copy or external publication payloads.**

Public output may contain:

- verified location facts;
- property type and transaction type;
- area and other approved factual attributes;
- configured company brand;
- configured company phone/WhatsApp/website;
- safe calls to action.

## Dashboard surfaces

The operations dashboard is organized around:

1. Overview — KPIs, health and queues.
2. Properties — canonical entities, evidence, provenance and matching.
3. Leads — intent, qualification, lifecycle and next actions.
4. Discovery — sources, policies, runs, failures and newly discovered candidates.
5. Content — factual drafts, marketing variants, safety checks and publication queue.
6. Review — human approvals, blocks and audit trail.
7. Insights — market graph, funnel performance, discovery yield and content analytics.
8. Workers & Jobs — retries, backoff, dead letters and operational state.
9. Settings — public identity, contact routing, channel policy, publication policy and feature flags.
10. Audit — immutable operational history.

## Next implementation boundary

The current dashboard is the control-plane shell and safe public-config surface. The next layer should replace placeholder KPIs with Supabase-backed queries and add authenticated operator mutations for brand/contact settings, review decisions and job controls.
