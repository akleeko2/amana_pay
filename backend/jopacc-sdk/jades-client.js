/**
 * Amana Pay — Mock JAdES B-B Client
 * -----------------------------------------------------------------------------
 * يحاكي خدمة JAdES (JSON Advanced Electronic Signature Level B-B).
 * المواصفة: POST /generateJAdESBB, POST /verifyJAdESBB, GET /publicKey.
 * الخوارزمية: RS256، والتوقيع يُوضع في هيدر x-jws-signature.
 *
 * نولّد زوج مفاتيح RSA حقيقياً (in-memory) لإنتاج توقيع قابل للتحقق فعلاً.
 */
'use strict';

const crypto = require('crypto');
const config = require('../config/config');

// زوج مفاتيح RSA يُولَّد مرة واحدة عند تحميل الوحدة (محاكاة JOPACC Private Key)
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

/** تسلسل ثابت (مفاتيح مرتّبة، تعاوديّاً) لإنتاج توقيع مستقل عن ترتيب المفاتيح. */
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

/** تطبيع الحمولة لتوقيع ثابت بغضّ النظر عن ترتيب المفاتيح. */
function canonical(body) {
  if (body == null) return '';
  return typeof body === 'string' ? body : stableStringify(body);
}

/**
 * إنشاء توقيع JAdES B-B منفصل (detached JWS) على الحمولة.
 * يُرجع التوقيع + الهيدر الجاهز x-jws-signature.
 */
function sign(body) {
  const payload = canonical(body);
  const protectedHeader = Buffer.from(
    JSON.stringify({ alg: config.jopacc.crypto.jadesAlg, b64: false, crit: ['b64'] })
  ).toString('base64url');

  const signingInput = `${protectedHeader}.${Buffer.from(payload).toString('base64url')}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url');

  // JWS منفصل (detached): الجزء الأوسط فارغ
  const detachedJws = `${protectedHeader}..${signature}`;
  return {
    'x-jws-signature': detachedJws,
    alg: config.jopacc.crypto.jadesAlg,
    signature,
  };
}

/** التحقق من توقيع منفصل مقابل الحمولة. */
function verify(body, detachedJws) {
  try {
    const payload = canonical(body);
    const [protectedHeader, , signature] = String(detachedJws).split('.');
    if (!protectedHeader || !signature) {
      return { digest: 'invalid', signature: 'invalid', status: 'failed' };
    }
    const signingInput = `${protectedHeader}.${Buffer.from(payload).toString('base64url')}`;
    const ok = crypto.verify(
      'RSA-SHA256',
      Buffer.from(signingInput),
      publicKey,
      Buffer.from(signature, 'base64url')
    );
    return ok
      ? { digest: 'valid', signature: 'valid', status: 'success' }
      : { digest: 'valid', signature: 'invalid', status: 'failed' };
  } catch {
    return { digest: 'invalid', signature: 'invalid', status: 'failed' };
  }
}

/** المفتاح العام بصيغة PEM + JWK (مقابلة GET /publicKey). */
function getPublicKey() {
  return {
    pem: publicKey.export({ type: 'spki', format: 'pem' }),
    jwk: publicKey.export({ format: 'jwk' }),
    alg: config.jopacc.crypto.jadesAlg,
  };
}

module.exports = { sign, verify, getPublicKey };
