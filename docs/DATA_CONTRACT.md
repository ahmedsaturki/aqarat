# Aqarat OS Data Contract

## Intake event

```json
{
  "channel": "telegram",
  "external_event_id": "<provider event id>",
  "sender_id": "<sender>",
  "chat_id": "<chat>",
  "raw_text": "<exact operator message>",
  "parsed_payload": {}
}
```

## Property candidate

```json
{
  "property_type": null,
  "transaction_type": null,
  "title": null,
  "description": null,
  "city": "مدينة السادات",
  "district": null,
  "neighborhood": null,
  "address": null,
  "area_m2": null,
  "bedrooms": null,
  "bathrooms": null,
  "floor": null,
  "finishing": null,
  "price": null,
  "currency": "EGP",
  "features": {},
  "confidence": null,
  "unknown_fields": []
}
```

## Rules

- Do not fabricate data.
- Preserve the source wording in `intake_events.raw_text`.
- Preserve evidence in `source_records`/`provenance` when data comes from external discovery.
- Normalize phone numbers before matching; retain the original value too.
- Treat AI output as a candidate until schema validation succeeds.
- Human confirmation is required for ambiguous or high-impact changes.
- Use idempotency keys for every inbound event and asynchronous job.
