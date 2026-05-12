const { supabase } = require('../db');

const sendPushNotification = async (userId, { title, body, data = {} }) => {
  try {
    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('token, platform')
      .eq('user_id', userId);

    if (error || !tokens || tokens.length === 0) return;

    const messages = tokens.map(({ token }) => ({
      to: token,
      sound: 'default',
      title,
      body,
      data,
    }));

    if (process.env.NODE_ENV === 'development') {
      console.log('Push notification:', { userId, title, body });
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
