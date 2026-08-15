# Aqarat Intelligence Layer

The intelligence layer is deterministic and explainable by design. It does not replace source evidence, validation, or human review.

## Signals

### Property opportunity score

`opportunity = confidence*0.30 + freshness*0.30 + completeness*0.20 + active_status*0.15 + price_available*0.05`

Freshness decays exponentially over a 14-day half-life-like window. A listing without a valid timestamp is deliberately penalized instead of being treated as fresh.

### Match score

Property-to-interest matching combines:

- city match: 25%
- district match: 15%
- property type: 15%
- transaction type: 15%
- price range: 15%
- area range: 5%
- buyer intent score: 10%

A match is `qualified` at `>= 0.72`.

## Explainability

Every score exposes component scores and human-readable signals such as:

- `fresh_listing`
- `stale_listing`
- `high_confidence`
- `well_described`
- `active_status`
- `price_available`
- `city_match`
- `district_match`
- `price_in_range`
- `area_in_range`

## Runtime API

`GET /api/dashboard/intelligence` returns the top opportunities for authenticated operators.

`GET /api/dashboard/intelligence?property_id=<uuid>` additionally returns the highest-scoring buyer interests for the selected property.

The endpoint is dashboard-session protected and uses Supabase service-role access server-side only.

## Safety

The scorer never invents a market price, contact identity, property attribute, or buyer intent. It ranks only fields already present in the source-of-truth database. AI can later enrich candidates, but its output must pass the same validation and provenance contracts before entering canonical state.
