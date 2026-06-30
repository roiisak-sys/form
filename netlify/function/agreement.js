// netlify/functions/agreement.js
//
// Minimal serverless endpoint. The form is now a single-session flow with no
// coach-signature step and no shareable link — it only needs to fetch a
// trainee's existing contact details (email/phone) from Airtable to
// auto-fill the form when the trainee selects themselves from their coach's
// list. Manual-entry trainees (not in the list) skip this lookup entirely
// and just type their own details.

const AIRTABLE_BASE_ID = 'appnKmW94PJcSJX6M';
const TRAINEE_TABLE_ID = 'tblqYz0a0fRBmTTnr'; // אנשי קשר
const FIELD_TRAINEE_FIRST = 'fld6C8N4F4VkWYqk3'; // First_name
const FIELD_TRAINEE_LAST = 'fldmil8JbLf5XwkeQ'; // Last_name
const FIELD_TRAINEE_EMAIL = 'fld2FX4Jcyiq1MM0r'; // Email
const FIELD_TRAINEE_PHONE = 'fldBWWx7DKXRHn2tV'; // Phone

const AIRTABLE_API_BASE = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;
const TRAINEE_API_BASE = `${AIRTABLE_API_BASE}/${TRAINEE_TABLE_ID}`;

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

function airtableHeaders() {
  const token = process.env.AIRTABLE_API_KEY;
  if (!token) {
    throw new Error('AIRTABLE_API_KEY environment variable is not set on this Netlify site.');
  }
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function airtableFetch(baseUrl, path, options) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: airtableHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data && data.error && data.error.message) || res.statusText;
    throw new Error(`Airtable error (${res.status}): ${message}`);
  }
  return data;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, {});
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const { action } = payload;

  try {
    if (action === 'lookup-trainee') {
      const { traineeRecordId } = payload;
      if (!traineeRecordId) return jsonResponse(400, { error: 'Missing traineeRecordId' });

      const record = await airtableFetch(
        TRAINEE_API_BASE,
        `/${traineeRecordId}?fields[]=${FIELD_TRAINEE_FIRST}&fields[]=${FIELD_TRAINEE_LAST}&fields[]=${FIELD_TRAINEE_EMAIL}&fields[]=${FIELD_TRAINEE_PHONE}`,
        { method: 'GET' }
      );

      return jsonResponse(200, {
        ok: true,
        trainee: {
          firstName: record.fields[FIELD_TRAINEE_FIRST] || '',
          lastName: record.fields[FIELD_TRAINEE_LAST] || '',
          email: record.fields[FIELD_TRAINEE_EMAIL] || '',
          phone: record.fields[FIELD_TRAINEE_PHONE] || '',
        },
      });
    }

    return jsonResponse(400, { error: 'Unknown action' });
  } catch (e) {
    console.error(e);
    return jsonResponse(500, { error: e.message || 'Internal error' });
  }
};
