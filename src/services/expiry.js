const supabase = require('../db');

async function expireConsents() {
  try {
    const { data: requests, error } = await supabase
      .from('consent_requests')
      .select('id, created_at, expires_in_minutes')
      .eq('status', 'accepted');

    if (error) throw error;

    const now = new Date();
    const expiredIds = (requests || [])
      .filter(r => {
        if (!r.expires_in_minutes) return false;
        const expiresAt = new Date(new Date(r.created_at).getTime() + r.expires_in_minutes * 60 * 1000);
        return now > expiresAt;
      })
      .map(r => r.id);

    if (expiredIds.length === 0) return;

    const { error: updateError } = await supabase
      .from('consent_requests')
      .update({ status: 'expired' })
      .in('id', expiredIds);

    if (updateError) throw updateError;

    console.log(`Expired ${expiredIds.length} consent request(s)`);
  } catch (err) {
    console.error('Expiry job error:', err);
  }
}

function startExpiryJob() {
  expireConsents();
  setInterval(expireConsents, 15 * 60 * 1000);
}

module.exports = { startExpiryJob };
