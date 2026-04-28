const crypto = require('crypto');
const { query } = require('../db');

const verifyRecordIntegrity = async (recordId) => {
  const result = await query(
    'SELECT id, terms_snapshot, agreement_hash FROM records WHERE id = $1',
    [recordId]
  );
  if (!result.rows.length) throw new Error('Record not found');
  const record = result.rows[0];
  const recomputed = crypto
    .createHash('sha256')
    .update(JSON.stringify(record.terms_snapshot))
    .digest('hex');
  return {
    record_id:     record.id,
    is_intact:     recomputed === record.agreement_hash,
    stored_hash:   record.agreement_hash,
    computed_hash: recomputed,
    verified_at:   new Date().toISOString(),
  };
};

const verifyAllRecordsForUser = async (userId) => {
  const result = await query(
    'SELECT id, terms_snapshot, agreement_hash FROM records WHERE owner_id = $1',
    [userId]
  );
  const results = result.rows.map(record => {
    const recomputed = crypto
      .createHash('sha256')
      .update(JSON.stringify(record.terms_snapshot))
      .digest('hex');
    return {
      record_id: record.id,
      is_intact: recomputed === record.agreement_hash,
    };
  });
  return { all_intact: results.every(r => r.is_intact), records: results };
};

module.exports = { verifyRecordIntegrity, verifyAllRecordsForUser };
