const { query } = require('../db');
const { sendPushNotification } = require('./push');

const expireAgreements = async () => {
  try {
    const result = await query(
      `UPDATE consent_requests
       SET status = 'expired'
       WHERE status IN ('pending', 'accepted')
         AND expires_at < NOW()
       RETURNING id, initiator_id, recipient_id, status`
    );
    if (!result.rows.length) return;
    console.log(`Expired ${result.rows.length} agreement(s)`);
    for (const req of result.rows) {
      await query(
        `UPDATE records SET status = 'expired'
         WHERE request_id = $1 AND status = 'accepted'`,
        [req.id]
      );
      await query(
        `INSERT INTO audit_log (event_type, request_id, metadata)
         VALUES ('consent_expired', $1, $2)`,
        [req.id, JSON.stringify({ auto_expired: true })]
      );
    }
  } catch (err) {
    console.error('Expiry job error:', err);
  }
};

const sendExpiryWarnings = async () => {
  try {
    const result = await query(
      `SELECT cr.id, cr.initiator_id, cr.recipient_id
       FROM consent_requests cr
       WHERE cr.status = 'accepted'
         AND cr.expires_at BETWEEN NOW() + INTERVAL '28 minutes'
                               AND NOW() + INTERVAL '32 minutes'`
    );
    for (const req of result.rows) {
      await sendPushNotification(req.initiator_id, {
        title: 'May I — Expiring soon',
        body: 'An active agreement expires in 30 minutes.',
        data: { type: 'consent_expiring_soon', request_id: req.id }
      });
      await sendPushNotification(req.recipient_id, {
        title: 'May I — Expiring soon',
        body: 'An active agreement expires in 30 minutes.',
        data: { type: 'consent_expiring_soon', request_id: req.id }
      });
    }
  } catch (err) {
    console.error('Expiry warning job error:', err);
  }
};

module.exports = { expireAgreements, sendExpiryWarnings };
