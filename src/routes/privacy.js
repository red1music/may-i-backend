const express = require('express');
const { query } = require('../db');
const { authenticate, requireVerified } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireVerified);

router.get('/export', async (req, res) => {
  const userId = req.user.id;
  try {
    const [userResult, recordsResult, auditResult, signaturesResult] = await Promise.all([
      query('SELECT id, phone, email, display_name, date_of_birth, created_at FROM users WHERE id = $1', [userId]),
      query('SELECT * FROM records WHERE owner_id = $1 ORDER BY signed_at DESC', [userId]),
      query('SELECT event_type, metadata, created_at FROM audit_log WHERE actor_id = $1 ORDER BY created_at DESC', [userId]),
      query('SELECT s.request_id, s.signed_at FROM signatures s WHERE s.user_id = $1', [userId]),
    ]);
    const exportData = {
      exported_at:  new Date().toISOString(),
      requested_by: userId,
      profile:      userResult.rows[0],
      agreements:   recordsResult.rows,
      signatures:   signaturesResult.rows,
      activity_log: auditResult.rows,
    };
    await query(`INSERT INTO audit_log (event_type, actor_id, metadata) VALUES ('data_export_requested', $1, '{}')`, [userId]);
    res.setHeader('Content-Disposition', 'attachment; filename="may-i-data-export.json"');
    res.setHeader('Content-Type', 'application/json');
    res.json(exportData);
  } catch (err) {
    console.error('Data export error:', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

router.post('/delete-account', async (req, res) => {
  const userId = req.user.id;
  try {
    await query(
      `UPDATE users SET phone = $1, email = NULL, display_name = 'Deleted user', date_of_birth = '2000-01-01', is_active = false, updated_at = NOW() WHERE id = $2`,
      [`deleted_${userId.substring(0, 8)}@deleted`, userId]
    );
    await query('DELETE FROM push_tokens WHERE user_id = $1', [userId]);
    await query(`UPDATE consent_requests SET status = 'expired' WHERE (initiator_id = $1 OR recipient_id = $1) AND status = 'pending'`, [userId]);
    await query(`UPDATE records SET owner_id = NULL WHERE owner_id = $1`, [userId]);
    await query(`INSERT INTO audit_log (event_type, actor_id, metadata) VALUES ('account_deleted', $1, $2)`,
      [userId, JSON.stringify({ deleted_at: new Date().toISOString() })]);
    res.json({ message: 'Account deleted.', deleted_at: new Date().toISOString() });
  } catch (err) {
    console.error('Account deletion error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

router.get('/summary', async (req, res) => {
  const userId = req.user.id;
  try {
    const [recordCount, auditCount] = await Promise.all([
      query('SELECT COUNT(*) FROM records WHERE owner_id = $1', [userId]),
      query('SELECT COUNT(*) FROM audit_log WHERE actor_id = $1', [userId]),
    ]);
    res.json({
      data_held: {
        profile:      'Phone number, display name, date of birth',
        agreements:   `${recordCount.rows[0].count} agreement record(s)`,
        activity_log: `${auditCount.rows[0].count} activity event(s)`,
      },
      retention_policy: {
        agreements:   'Permanent — cannot be deleted by design',
        activity_log: 'Permanent — audit trail',
        profile:      'Deleted on account deletion',
      },
      contact: 'privacy@mayi.app',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch privacy summary' });
  }
});

module.exports = router;
