const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/me', async (req, res) => {
  try {
    const { data: user } = await supabase.from('users').select('*').eq('id', req.user.userId).single();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.post('/push-token', async (req, res) => {
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

router.put("/me", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });
    await supabase.from("users").update({ name }).eq("id", req.user.userId);
    res.json({ message: "Name updated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update name" });
  }
});

module.exports = router;
