// netlify/functions/agreement.js
//
// Single serverless endpoint that the form calls instead of window.storage.
// Holds the Airtable API token server-side (set as an environment variable
// in the Netlify site settings — never shipped to the browser).
//
// Routes (all POST, distinguished by body.action):
//   "trainees" - list trainees linked to a given coach (for the dropdown)
//   "submit"   - trainee finished signing -> write into their existing row, return a token
//   "load"     - coach opened their link -> fetch the row by token
//   "complete" - coach finished signing -> update the row

const AIRTABLE_BASE_ID = 'appnKmW94PJcSJX6M';
const TEAM_TABLE_ID = 'tblKp913IugEJy0Lo'; // צוות (coaches)
const TRAINEE_TABLE_ID = 'tblqYz0a0fRBmTTnr'; // אנשי קשר (trainees)
const FIELD_FORM_DATA = 'fldTBTyyBL9iXPVmZ'; // טופס פרטי מתאמן והליך אימון
const FIELD_STATUS = 'fldSNYxVt9uPU8Twl'; // סטטוס חתימת טופס
const FIELD_TRAINEE_FIRST = 'fld6C8N4F4VkWYqk3'; // First_name
const FIELD_TRAINEE_LAST = 'fldmil8JbLf5XwkeQ'; // Last_name
const FIELD_TRAINEE_EMAIL = 'fld2FX4Jcyiq1MM0r'; // Email
const FIELD_TRAINEE_PHONE = 'fldBWWx7DKXRHn2tV'; // Phone
const FIELD_COACH_TRAINEES = 'fldWUhOR2OnQBwqaz'; // תלמידים משוייכים למאמן (on the צוות record)

const AIRTABLE_API_BASE = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;
const TRAINEE_API_BASE = `${AIRTABLE_API_BASE}/${TRAINEE_TABLE_ID}`;
const TEAM_API_BASE = `${AIRTABLE_API_BASE}/${TEAM_TABLE_ID}`;

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

function genToken() {
  // 24 random bytes, URL-safe — used as the secret in the coach's link.
  const bytes = require('crypto').randomBytes(18);
  return bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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

async function findRecordByToken(token) {
  const formula = encodeURIComponent(`FIND("\\"token\\":\\"${token}\\"", {${FIELD_FORM_DATA}})`);
  const data = await airtableFetch(TRAINEE_API_BASE, `?filterByFormula=${formula}&maxRecords=1`, { method: 'GET' });
  if (!data.records || data.records.length === 0) return null;
  return data.records[0];
}

async function getCoachWithTrainees(coachRecordId) {
  const data = await airtableFetch(
    TEAM_API_BASE,
    `/${coachRecordId}?fields[]=First_name&fields[]=Last%20name&fields[]=Email&fields[]=${FIELD_COACH_TRAINEES}`,
    { method: 'GET' }
  );
  return data;
}

async function getTraineesByIds(traineeIds) {
  if (!traineeIds || traineeIds.length === 0) return [];
  // Airtable has no bulk-get-by-IDs endpoint; fetch each trainee record individually.
  // Trainee lists per coach are small (typically under ~25), so this stays fast.
  const results = await Promise.all(
    traineeIds.map((id) =>
      airtableFetch(
        TRAINEE_API_BASE,
        `/${id}?fields[]=${FIELD_TRAINEE_FIRST}&fields[]=${FIELD_TRAINEE_LAST}&fields[]=${FIELD_TRAINEE_EMAIL}&fields[]=${FIELD_TRAINEE_PHONE}`,
        { method: 'GET' }
      ).catch(() => null)
    )
  );
  return results.filter(Boolean);
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
    if (action === 'trainees') {
      const { coachRecordId } = payload;
      if (!coachRecordId) return jsonResponse(400, { error: 'Missing coachRecordId' });

      const coach = await getCoachWithTrainees(coachRecordId);
      const traineeIds = (coach.fields && coach.fields[FIELD_COACH_TRAINEES]) || [];
      const traineeRecords = await getTraineesByIds(traineeIds);

      const trainees = traineeRecords.map((r) => ({
        id: r.id,
        firstName: r.fields[FIELD_TRAINEE_FIRST] || '',
        lastName: r.fields[FIELD_TRAINEE_LAST] || '',
        email: r.fields[FIELD_TRAINEE_EMAIL] || '',
        phone: r.fields[FIELD_TRAINEE_PHONE] || '',
      }));

      return jsonResponse(200, { ok: true, trainees });
    }

    if (action === 'submit') {
      const { traineeRecordId, record } = payload;
      if (!traineeRecordId || !record) {
        return jsonResponse(400, { error: 'Missing traineeRecordId or record' });
      }
      const token = genToken();
      const storedRecord = { ...record, token, status: 'pending_coach' };

      await airtableFetch(TRAINEE_API_BASE, `/${traineeRecordId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fields: {
            [FIELD_FORM_DATA]: JSON.stringify(storedRecord),
            [FIELD_STATUS]: 'ממתין לחתימת מאמן',
          },
        }),
      });

      return jsonResponse(200, { ok: true, token });
    }

    if (action === 'load') {
      const { token } = payload;
      if (!token) return jsonResponse(400, { error: 'Missing token' });

      const airtableRecord = await findRecordByToken(token);
      if (!airtableRecord) return jsonResponse(404, { error: 'not_found' });

      const stored = JSON.parse(airtableRecord.fields[FIELD_FORM_DATA] || '{}');
      return jsonResponse(200, { ok: true, record: stored, airtableRecordId: airtableRecord.id });
    }

    if (action === 'complete') {
      const { token, coachSignature, coachSignedAt } = payload;
      if (!token || !coachSignature) {
        return jsonResponse(400, { error: 'Missing token or coachSignature' });
      }

      const airtableRecord = await findRecordByToken(token);
      if (!airtableRecord) return jsonResponse(404, { error: 'not_found' });

      const stored = JSON.parse(airtableRecord.fields[FIELD_FORM_DATA] || '{}');
      stored.coachSignature = coachSignature;
      stored.coachSignedAt = coachSignedAt;
      stored.status = 'completed';

      await airtableFetch(TRAINEE_API_BASE, `/${airtableRecord.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fields: {
            [FIELD_FORM_DATA]: JSON.stringify(stored),
            [FIELD_STATUS]: 'הושלם - שני חתימות',
          },
        }),
      });

      return jsonResponse(200, { ok: true, record: stored });
    }

    return jsonResponse(400, { error: 'Unknown action' });
  } catch (e) {
    console.error(e);
    return jsonResponse(500, { error: e.message || 'Internal error' });
  }
};
