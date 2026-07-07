/**
 * Amana Pay — Mock Auth Client
 * -----------------------------------------------------------------------------
 * يحاكي طبقة أمان بوابة JoPACC:
 *  - apiKey عبر هيدر x-Gateway-APIKey
 *  - HTTP Basic Auth
 *  - إصدار access tokens وهمية
 * كما يوفّر توليد الهيدرات الإلزامية (عبر _helpers).
 */
'use strict';

const crypto = require('crypto');
const config = require('../config/config');
const { buildHeaders, errors } = require('./_helpers');

/** التحقق من مفتاح البوابة (x-Gateway-APIKey). */
function verifyApiKey(key) {
  return key === config.jopacc.security.apiKey;
}

/** التحقق من HTTP Basic Auth. */
function verifyBasicAuth(authorizationHeader) {
  if (!authorizationHeader || !/^Basic\s+/i.test(authorizationHeader)) return false;
  const decoded = Buffer.from(authorizationHeader.replace(/^Basic\s+/i, ''), 'base64').toString('utf8');
  const [user, pass] = decoded.split(':');
  return user === config.jopacc.security.basicUser && pass === config.jopacc.security.basicPass;
}

/** ترويسة Basic Auth جاهزة (للاستخدام الداخلي). */
function basicAuthHeader() {
  const raw = `${config.jopacc.security.basicUser}:${config.jopacc.security.basicPass}`;
  return 'Basic ' + Buffer.from(raw).toString('base64');
}

/**
 * إصدار access token وهمي (نتيجة تبادل OAuth).
 * يحمل النطاق (scope) والموضوع (subject) ومدة الصلاحية.
 */
function issueToken({ subject, scope = ['AccountInfo'], ttlSeconds = 3600 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const token = {
    sub: subject,
    scope,
    iat: now,
    exp: now + ttlSeconds,
    jti: crypto.randomUUID(),
  };
  const accessToken = Buffer.from(JSON.stringify(token)).toString('base64url');
  return { accessToken, tokenType: 'Bearer', expiresIn: ttlSeconds, scope };
}

/** فك access token وهمي (مع التحقق من الانتهاء). */
function introspect(accessToken) {
  try {
    const claims = JSON.parse(Buffer.from(accessToken, 'base64url').toString('utf8'));
    const active = claims.exp > Math.floor(Date.now() / 1000);
    return { active, ...claims };
  } catch {
    throw errors.unauthorized('Invalid access token');
  }
}

module.exports = {
  verifyApiKey,
  verifyBasicAuth,
  basicAuthHeader,
  issueToken,
  introspect,
  buildHeaders,
};
