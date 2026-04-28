const crypto = require('crypto');

const deriveAgreementKey = (userId1, userId2, requestId) => {
  const sorted   = [userId1, userId2].sort().join(':');
  const material = `${sorted}:${requestId}:${process.env.ENCRYPTION_SECRET}`;
  return crypto.createHash('sha256').update(material).digest();
};

const encryptTerms = (plaintext, userId1, userId2, requestId) => {
  const key = deriveAgreementKey(userId1, userId2, requestId);
  const iv  = crypto.randomBytes(12);
  const cipher    = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(plaintext), 'utf8'), cipher.final()]);
  const authTag   = cipher.getAuthTag();
  return {
    iv:      iv.toString('base64'),
    tag:     authTag.toString('base64'),
    data:    encrypted.toString('base64'),
    version: 1,
  };
};

const decryptTerms = (encrypted, userId1, userId2, requestId) => {
  const key = deriveAgreementKey(userId1, userId2, requestId);
  const iv  = Buffer.from(encrypted.iv,   'base64');
  const tag = Buffer.from(encrypted.tag,  'base64');
  const enc = Buffer.from(encrypted.data, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
};

const hashForStorage = (value) =>
  crypto.createHash('sha256').update(value + process.env.HASH_SALT).digest('hex');

module.exports = { encryptTerms, decryptTerms, hashForStorage };
