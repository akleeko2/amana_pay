/**
 * Amana Pay — Mock JWE Client
 * -----------------------------------------------------------------------------
 * يحاكي خدمة JWE (JSON Web Encryption) v3.0.1.
 * المواصفة: POST /generateJWE, POST /verifyJWE, GET /publicKey.
 * الخوارزميات: alg = RSA-OAEP-256, enc = A256GCM.
 *
 * تنفيذ حقيقي مبسّط: مفتاح محتوى عشوائي (CEK) يُشفّر بـ RSA-OAEP-256،
 * والحمولة تُشفّر بـ AES-256-GCM. الناتج JWE Compact Serialization.
 */
'use strict';

const crypto = require('crypto');
const config = require('../config/config');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

const ALG = config.jopacc.crypto.jweAlg; // RSA-OAEP-256
const ENC = config.jopacc.crypto.jweEnc; // A256GCM

/** تشفير حمولة وإرجاع JWE Compact (خمسة أجزاء مفصولة بنقاط). */
function encrypt(payload) {
  const plaintext = Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload));

  const protectedHeader = Buffer.from(JSON.stringify({ alg: ALG, enc: ENC })).toString('base64url');

  const cek = crypto.randomBytes(32); // 256-bit content encryption key
  const iv = crypto.randomBytes(12); // 96-bit nonce لـ GCM

  const cipher = crypto.createCipheriv('aes-256-gcm', cek, iv, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(protectedHeader));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  const encryptedKey = crypto.publicEncrypt(
    { key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    cek
  );

  return [
    protectedHeader,
    encryptedKey.toString('base64url'),
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    tag.toString('base64url'),
  ].join('.');
}

/** فك تشفير JWE Compact وإرجاع الحمولة الأصلية (مقابلة /verifyJWE). */
function decrypt(jweToken) {
  const [protectedHeader, encryptedKey, iv, ciphertext, tag] = String(jweToken).split('.');
  if (!protectedHeader || !encryptedKey || !iv || !ciphertext || !tag) {
    throw new Error('Invalid JWE compact serialization');
  }

  const cek = crypto.privateDecrypt(
    { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(encryptedKey, 'base64url')
  );

  const decipher = crypto.createDecipheriv('aes-256-gcm', cek, Buffer.from(iv, 'base64url'), {
    authTagLength: 16,
  });
  decipher.setAAD(Buffer.from(protectedHeader));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');

  try {
    return JSON.parse(plaintext);
  } catch {
    return plaintext;
  }
}

function getPublicKey() {
  return { pem: publicKey.export({ type: 'spki', format: 'pem' }), alg: ALG, enc: ENC };
}

module.exports = { encrypt, decrypt, getPublicKey };
