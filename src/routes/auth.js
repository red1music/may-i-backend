const express = require('express');
const jwt = require('jsonwebtoken');
const { supabase } = require('../db');
const { sendOTP, verifyOTP } = require('../services/sms');

const router = express.Router();

router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number required' });
    await sendOTP(phone);
    res.json({ message: 'Code sent successfully' });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Failed to send code' });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: 'Phone and code required' });
    const valid = verifyOTP(phone, code);
    if (!valid) return res.status(400).json({ error: 'Invalid or expired code' });

    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .single();

    if (!user) {
      const { data: newUser } = await supabase
        .from('users')
        .insert({ phone, name: phone, is_verified: true })
        .select()
        .single();
      user = newUser;
    }

    const token = jwt.sign({ phone, userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, message: 'Verified successfully' });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

module.exports = router;