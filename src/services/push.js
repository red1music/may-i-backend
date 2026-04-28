const { query } = require('../db');

const sendPushNotification = async (userId, { title, body, data = {} }) => {
  try {
    const tokenResult = await query(
      'SELECT token, platform FROM push_tokens WHERE user_id = $1',
      [userId]
    );
    if (!tokenResult.rows.length) return;

    const messages = tokenResult.rows.map(({ token }) => ({
      to: token,
      sound: 'default',
      title,
      body,
      data,
    }));

    if (process.env.NODE_ENV === 'development') {
      console.log('Push notification:', { userId, title, body });
      return;
    }

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    return await response.json();
  } catch (err) {
    console.error('Push notification error:', err);
  }
};

module.exports = { sendPushNotification };
