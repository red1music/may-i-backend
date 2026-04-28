const { Vonage } = require('@vonage/server-sdk');

const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET,
});

const otpStore = {};

const sendOTP = async (phone) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[phone] = { code, expiresAt: Date.now() + 10 * 60 * 1000 };
  console.log(`OTP for ${phone} is ${code}`);
  try {
    await vonage.sms.send({ to: phone, from: 'MayI', text: `Your May I code is: ${code}` });
  } catch (err) {
    console.log('Vonage response:', err);
  }
};

const verifyOTP = (phone, code) => {
  const stored = otpStore[phone];
  if (!stored) return false;
  if (Date.now() > stored.expiresAt) return false;
  return stored.code === code;
};

module.exports = { sendOTP, verifyOTP };
