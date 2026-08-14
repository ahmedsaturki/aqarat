# Discovery Source Policy

Aqarat discovery is **allowlist-first**. A source is never crawled merely because it is public.

## Required source gate

A source must have:

- `enabled: true`
- `crawl_policy.automation_allowed: true`
- `crawl_policy.allowed_domains` containing the target hostname
- HTTPS URL
- no authentication or session requirement
- no CAPTCHA/bot-control bypass
- no request to defeat robots/access controls
- a documented basis for automated access (permission, compatible terms, an explicitly permitted feed/export, or an owner-controlled source)

If any requirement is missing, the discovery worker must fail closed with `discovery_source_policy_blocked`.

## Important sources checked during V1 research

### Property Finder Egypt

Property Finder's current terms state that users must not use automated devices/software/processes to access, retrieve, scrape, or index the website/content. Therefore it is **not an automated discovery source** for Aqarat unless explicit permission or an authorized feed is obtained. See the current terms: https://www.propertyfinder.eg/en/terms-and-conditions.html

### Bayut Egypt

Bayut Egypt's terms state that users must not use automated software to view the service without consent and must access it manually. Therefore it is **not an automated discovery source** unless explicit permission or an authorized feed is obtained. See the current terms: https://www.bayut.eg/en/terms.html

## What Aqarat can use

Prefer, in order:

1. Owner-controlled websites and pages.
2. Sources where the owner explicitly permits automated access.
3. Public feeds/exports/sitemaps whose terms permit the intended use.
4. Public Telegram/owned channels supplied by the operator, subject to their rules and privacy requirements.
5. Human-assisted research where automated collection is not permitted.

## Personal contact data

Phone numbers, names, addresses and similar identifiers are treated as personal data. The system must retain provenance and a lawful/appropriate collection basis and must not turn public visibility into permission for unsolicited marketing. Publication and outbound-contact jobs therefore remain policy-gated and reviewable.

This is an engineering control, not legal advice. The production operating policy should be reviewed against the applicable Egyptian data-protection and communications rules before bulk outreach.
