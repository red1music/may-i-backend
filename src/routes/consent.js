const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { supabase } = require('../db');
const router = express.Router();
const { sendPushNotification } = require('../services/push');
const { sendAppInvite } = require('../services/sms');

router.use(authenticate);

router.post('/request', [body('recipient_phone').notEmpty(), body('categories').isArray({ min: 1 }), body('expires_in_minutes').isInt({ min: 1 })], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { recipient_phone, categories, expires_in_minutes, note } = req.body;
  try {
    const { data: recipient } = await supabase.from('users').select('id').eq('phone', recipient_phone).single();
    if (!recipient) {
      await sendAppInvite(recipient_phone).catch(() => {});
      return res.status(404).json({ error: "This person does not have May I yet. We sent them a link to download the app." });
    }
      sendPushNotification(recipient.id, 'New Consent Request', 'Someone is asking for your consent on May I.', {}).catch(() => {});
    const { data: request, error } = await supabase.from('consent_requests').insert({ requester_id: req.user.userId, recipient_id: recipient.id, category: categories.join(', '), note: note || null }).select().single();
    if (error) throw error;
    res.status(201).json({ request_id: request.id, status: 'pending' });
  } catch (err) {
    console.error('Create consent request error:', err);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

router.get('/pending', async (req, res) => {
  try {
    const { data: requests } = await supabase.from('consent_requests').select('*, requester:requester_id(phone, name)').eq('recipient_id', req.user.userId).eq('status', 'pending')
      .order('created_at', { ascending: false });
    const formatted = (requests || []).map(r => ({ id: r.id, categories: r.category.split(', '), initiator_phone: r.requester?.phone, initiator_name: r.requester?.name, status: r.status, expires_in_minutes: r.expires_in_minutes, note: r.note }));
    res.json({ requests: formatted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

router.get('/mine', async (req, res) => {
  try {
    const { data: requests } = await supabase.from('consent_requests').select('*, recipient:recipient_id(phone, name)').eq('requester_id', req.user.userId)
      .order('created_at', { ascending: false });
    const formatted = (requests || []).map(r => ({ id: r.id, categories: r.category.split(', '), recipient_phone: r.recipient?.phone, recipient_name: r.recipient?.name, status: r.status, note: r.note, expires_in_minutes: r.expires_in_minutes }));
    res.json({ requests: formatted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

router.post('/:id/respond', [body('response').isIn(['accepted', 'declined'])], async (req, res) => {
  const { id } = req.params;
  const { response } = req.body;
  try {
    const { error } = await supabase.from('consent_requests').update({ status: response }).eq('id', id).eq('recipient_id', req.user.userId);
    if (error) throw error;
    res.json({ status: response });
  } catch (err) {
    res.status(500).json({ error: 'Failed to respond' });
  }
});

router.post('/:id/revoke', async (req, res) => {
  const { id } = req.params;
  try {
    const { data: request, error: fetchError } = await supabase.from('consent_requests').select('*').eq('id', id).eq('requester_id', req.user.userId).single();
    if (fetchError || !request) return res.status(404).json({ error: 'Request not found' });
    const { error: updateError } = await supabase.from('consent_requests').update({ status: 'revoked' }).eq('id', id);
    if (updateError) throw updateError;
    const { error: recordError } = await supabase.from('consent_records').insert({ consent_request_id: id, decision: 'revoked' });
    if (recordError) throw recordError;
    res.json({ status: 'revoked' });
  } catch (err) {
    console.error('Revoke error:', err);
    res.status(500).json({ error: 'Failed to revoke consent' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const { data: requests } = await supabase
      .from('consent_requests')
      .select('*, recipient:recipient_id(phone, name), requester:requester_id(phone, name), records:consent_records(decision, decided_at)')
      .or('requester_id.eq.' + req.user.userId + ',recipient_id.eq.' + req.user.userId)
      .not('status', 'eq', 'pending')
      .order('created_at', { ascending: false });
    const formatted = (requests || []).map(r => ({
      id: r.id,
      action: r.status,
      category: r.category,
      created_at: r.records?.[0]?.decided_at || r.created_at,
      other_phone: r.requester_id === req.user.userId ? r.recipient?.phone : r.requester?.phone, other_name: r.requester_id === req.user.userId ? r.recipient?.name : r.requester?.name,
      direction: r.requester_id === req.user.userId ? 'sent' : 'received',
      expires_in_minutes: r.expires_in_minutes,
    }));
    res.json({ records: formatted });
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
