import axios from 'axios';
import crypto from 'crypto';

/**
 * Sends a message to a DingTalk custom robot webhook.
 * @param accessToken The webhook access_token
 * @param secret The secret for signing
 * @param msg The message content
 */
export async function sendDingTalkMessage(accessToken: string, secret: string, msg: string) {
  const timestamp = Date.now();
  const stringToSign = `${timestamp}\n${secret}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(stringToSign);
  const sign = encodeURIComponent(hmac.digest('base64'));

  const url = `https://oapi.dingtalk.com/robot/send?access_token=${accessToken}&timestamp=${timestamp}&sign=${sign}`;

  const body = {
    msgtype: 'text',
    text: {
      content: msg
    },
    at: {
      isAtAll: true
    }
  };

  try {
    const response = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to send DingTalk message:', error);
    throw error;
  }
}
