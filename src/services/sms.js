const { Vonage } = require('@vonage/server-sdk');
const { supabase } = require('../db');

const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET,
});

const sendOTP = async (phone) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await supabase.from('otp_codes').delete().eq('phone', phone);
  await supabase.from('otp_codes').insert({ phone, code, expires_at: expiresAt });

  await vonage.sms.send({
    to: phone,
    from: '15815301745',
    text: `Your May I verification code is: ${code}`,
  });
};

const verifyOTP = async (phone, code) => {
  const { data } = await supabase
    .from('otp_codes')
    .select('*')
    .eq('phone', phone)
    .eq('code', code)
    .single();

  if (!data) return false;
  if (new Date() > new Date(data.expires_at)) return false;

  await supabase.from('otp_codes').delete().eq('phone', phone);
  return true;
};

const sendAppInvite = async (phone) => {
  await vonage.sms.send({
    to: phone,
    from: '15815301745',
    text: 'You have a consent request waiting for you on the May I app. Download it here: https://mayi.app',
  });
};

module.exports = { sendOTP, verifyOTP, sendAppInvite };
