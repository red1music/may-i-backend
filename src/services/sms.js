const Vonage = require('@vonage/server-sdk');

const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET,
});

const otpStore = {};

const sendOTP = async (phone) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[phone] = { code, expiresAt: Date.now() + 10 * 60 * 1000 };
  await new Promise((resolve, reject) => {
    vonage.message.sendSms('May I', phone, `Your May I verification code is: ${code}`, (err, responseData) => {
      if (err) reject(err);
      else resolve(responseData);
    });
  });
};

const verifyOTP = (phone, code) => {
  const stored = otpStore[phone];
  if (!stored) return false;
  if (Date.now() > stored.expiresAt) return false;
  return stored.code === code;
};

module.exports = { sendOTP, verifyOTP };
