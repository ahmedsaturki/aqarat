const SECRET = PropertiesService.getScriptProperties().getProperty('AQARAT_SHEETS_SECRET');
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('AQARAT_SPREADSHEET_ID');
const SHEET_NAME = PropertiesService.getScriptProperties().getProperty('AQARAT_SHEET_NAME') || 'Properties';

function json_(payload, status) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const incomingSecret = e && e.parameter && e.parameter.secret
      ? e.parameter.secret
      : (e && e.postData && e.postData.contents ? null : null);

    const body = e && e.postData && e.postData.contents
      ? JSON.parse(e.postData.contents)
      : null;

    const headerSecret = body && body.secret ? String(body.secret) : incomingSecret;
    if (!SECRET || headerSecret !== SECRET) {
      return json_({ ok: false, error: 'unauthorized' }, 401);
    }

    if (!SPREADSHEET_ID) {
      return json_({ ok: false, error: 'AQARAT_SPREADSHEET_ID_required' }, 500);
    }

    if (!body || body.operation !== 'upsert_property') {
      return json_({ ok: false, error: 'unsupported_operation' }, 422);
    }

    const columns = Array.isArray(body.columns) ? body.columns : [];
    const values = Array.isArray(body.values) ? body.values : [];
    const externalKey = String(body.external_key || '').trim();

    if (!externalKey || !columns.length || columns.length !== values.length) {
      return json_({ ok: false, error: 'invalid_projection' }, 422);
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    const headerRange = sheet.getRange(1, 1, 1, columns.length);
    const existingHeaders = headerRange.getValues()[0];
    const hasHeaders = existingHeaders.some((v) => String(v || '').trim());

    if (!hasHeaders || String(existingHeaders[0] || '').trim() !== String(columns[0])) {
      headerRange.setValues([columns]);
    }

    const lastRow = sheet.getLastRow();
    let targetRow = 0;
    if (lastRow >= 2) {
      const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(String);
      const index = keys.findIndex((key) => key === externalKey);
      if (index >= 0) targetRow = index + 2;
    }

    if (!targetRow) targetRow = Math.max(2, sheet.getLastRow() + 1);
    sheet.getRange(targetRow, 1, 1, values.length).setValues([values]);

    return json_({
      ok: true,
      property_id: externalKey,
      row: targetRow,
      sheet: SHEET_NAME,
    }, 200);
  } catch (error) {
    console.error(error);
    return json_({ ok: false, error: String(error && error.message || error) }, 500);
  }
}
