const express = require('express');
const { query } = require('../db');
const { authenticate, requireVerified } = require('../middleware/auth');
const { decryptTerms } = require('../services/encryption');

const router = express.Router();
router.use(authenticate, requireVerified);

const safeDecrypt = (record) => {
  try {
    const snap = record.terms_snapshot;
    if (snap && snap.iv && snap.tag && snap.data) {
      return decryptTerms(snap, record.owner_id, record.other_party_id, record.request_id);
    }
    return snap;
  } catch {
    return record.terms_snapshot;
  }
};

router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT r.id, r.request_id, r.other_party_name, r.other_party_id, r.terms_snapshot,
              r.agreement_hash, r.signed_at, r.expires_at, r.status, r.created_at,
              CASE WHEN r.expires_at > NOW() AND r.status = 'accepted' THEN true ELSE false END as is_active
       FROM records r WHERE r.owner_id = $1 ORDER BY r.signed_at DESC`,
      [req.user.id]
    );
    res.json({ records: result.rows.map(r => ({ ...r, terms_snapshot: safeDecrypt(r) })) });
  } catch (err) {
    console.error('Fetch records error:', err);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

router.get('/verify-all', async (req, res) => {
  try {
    const { verifyAllRecordsForUser } = require('../services/integrity');
    const result = await verifyAllRecordsForUser(req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify records' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT r.*, al.event_type, al.created_at as event_time, al.metadata
       FROM records r
       LEFT JOIN audit_log al ON al.request_id = r.request_id
       WHERE r.id = $1 AND r.owner_id = $2
       ORDER BY al.created_at ASC`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Record not found' });
    const record = { ...result.rows[0], terms_snapshot: safeDecrypt(result.rows[0]) };
    const auditEvents = result.rows
      .map(r => ({ event_type: r.event_type, time: r.event_time, metadata: r.metadata }))
      .filter(e => e.event_type);
    res.json({ record, audit_trail: auditEvents });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch record' });
  }
});

router.get('/:id/verify', async (req, res) => {
  try {
    const owns = await query('SELECT id FROM records WHERE id = $1 AND owner_id = $2', [req.params.id, req.user.id]);
    if (!owns.rows.length) return res.status(404).json({ error: 'Record not found' });
    const { verifyRecordIntegrity } = require('../services/integrity');
    const result = await verifyRecordIntegrity(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify record' });
  }
});

router.delete('/:id', (req, res) => {
  res.status(403).json({ error: 'Records cannot be deleted. This is by design.', code: 'IMMUTABLE_RECORD' });
});

module.exports = router;
