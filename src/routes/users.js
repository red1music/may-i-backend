const express = require('express');
const { authenticate } = require('../middleware/auth');
const { supabase } = require('../db');
const router = express.Router();

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

router.post('/set-name', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    await supabase.from('users').update({ name }).eq('id', req.user.userId);
    res.json({ message: 'Name updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update name' });
  }
});

module.exports = router;
