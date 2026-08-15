# Discovery Source Permission Evidence

Every automated Discovery source must have explicit, reviewable permission evidence before it is enabled for automated collection.

Required fields:

- source key and canonical URL
- evidence type (terms, robots, written approval, platform API policy, or other documented basis)
- evidence URL or archived reference
- owner responsible for approval
- reviewed/verified timestamp
- optional expiry/review date
- status: `pending`, `verified`, `approved`, `expired`, or `rejected`
- notes describing the allowed scope

`discovery_permission_evidence` in Supabase is the system-of-record for this control.

A source without active `verified`/`approved` evidence must remain disabled or `manual_assisted`.

This policy does not authorize bypassing access controls, CAPTCHAs, rate limits, login requirements, or terms of service.
