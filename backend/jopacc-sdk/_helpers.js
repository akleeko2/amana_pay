/**
 * Amana Pay — Mock SDK Shared Helpers
 * -----------------------------------------------------------------------------
 * أدوات مشتركة بين clients: توليد الهيدرات الإلزامية، تأخير محاكى،
 * وبناء أخطاء بنمط JoPACC (id/code/desc/errors).
 */
'use strict';

const crypto = require('crypto');
const config = require('../config/config');

/** تأخير بسيط لمحاكاة زمن الشبكة (لا يُستخدم في الاختبارات السريعة). */
function delay(ms = 0) {
  if (!ms) return Promise.resolve();
  return new Promise((r) => setTimeout(r, ms));
}

/** توليد الهيدرات الإلزامية المشتركة عبر خدمات JOF. */
function buildHeaders({ accessToken = 'mock-access-token', jwsSignature, idempotencyKey } = {}) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'x-interactions-id': crypto.randomUUID(),
    'x-idempotency-key': idempotencyKey || crypto.randomUUID(),
    'x-jws-signature': jwsSignature || 'mock.detached.jws',
    [config.jopacc.security.apiKeyHeader]: config.jopacc.security.apiKey,
  };
}

/** خطأ بنمط JoPACC: يُرمى ويُمسك في الطبقات الأعلى. */
function ofError(status, code, desc, errors) {
  const err = new Error(desc);
  err.status = status;
  err.code = code;
  err.desc = desc;
  err.id = crypto.randomUUID();
  if (errors) err.errors = errors;
  err.isJopaccError = true;
  return err;
}

const errors = {
  notFound: (desc = 'Resource not found') => ofError(404, 'resource.not_found', desc),
  badRequest: (desc = 'Invalid request parameters', e) => ofError(400, 'http.request.invalid', desc, e),
  unauthorized: (desc = 'Invalid authentication credentials') => ofError(401, 'http.auth.invalid', desc),
};

/** التحقق من وجود الهيدرات الإلزامية (محاكاة لتحقق البوابة). */
function assertRequiredHeaders(headers = {}) {
  const lower = Object.fromEntries(Object.keys(headers).map((k) => [k.toLowerCase(), headers[k]]));
  for (const h of config.jopacc.requiredHeaders) {
    if (!lower[h.toLowerCase()]) {
      throw errors.badRequest(`Required header ${h} is missing`, [
        { code: 'http.headers.invalid', desc: `Required header ${h} is missing` },
      ]);
    }
  }
}

module.exports = { delay, buildHeaders, ofError, errors, assertRequiredHeaders };
