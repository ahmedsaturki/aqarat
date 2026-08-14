const SHEET_COLUMNS = [
  'property_id',
  'status',
  'transaction_type',
  'property_type',
  'title',
  'city',
  'district',
  'neighborhood',
  'address',
  'area_m2',
  'bedrooms',
  'bathrooms',
  'floor',
  'finishing',
  'price',
  'currency',
  'contact_name',
  'primary_phone',
  'source_channel',
  'source_event_id',
  'confidence',
  'updated_at',
];

function value(v) {
  return v == null ? '' : String(v);
}

/**
 * Build a stable, column-ordered projection. The worker that owns Google
 * credentials can write this row using external_key=property_id.
 */
export function propertyToSheetRow(property, context = {}) {
  const contact = property.primary_contact ?? context.primary_contact ?? null;

  return {
    columns: SHEET_COLUMNS,
    values: [
      value(property.id),
      value(property.status),
      value(property.transaction_type),
      value(property.property_type),
      value(property.title),
      value(property.city),
      value(property.district),
      value(property.neighborhood),
      value(property.address),
      value(property.area_m2),
      value(property.bedrooms),
      value(property.bathrooms),
      value(property.floor),
      value(property.finishing),
      value(property.price),
      value(property.currency),
      value(contact?.name ?? context.contact_name),
      value(contact?.phone ?? context.primary_phone),
      value(context.source_channel),
      value(context.source_event_id),
      value(property.confidence),
      value(property.updated_at ?? context.updated_at),
    ],
    external_key: value(property.id),
  };
}

export function sheetHeaders() {
  return [...SHEET_COLUMNS];
}
