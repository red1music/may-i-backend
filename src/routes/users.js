const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const authenticate = require('../middleware/auth');

router.post('/push-token', authenticate, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    await supabase.from('push_tokens').delete().eq('user_id', req.user.userId);
    await supabase.from('push_tokens').insert({ user_id: req.user.userId, token, platform: 'android' });

    res.json({ message: 'Push token saved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save push token' });
  }
});

module.exports = router;
