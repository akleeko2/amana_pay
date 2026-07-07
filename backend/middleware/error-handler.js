/**
 * Amana Pay — Unified Error & 404 Handlers
 * -----------------------------------------------------------------------------
 * صيغة خطأ JSON موحّدة مستوحاة من أخطاء JoPACC (id, code, desc, errors).
 */
'use strict';

const crypto = require('crypto');
const config = require('../config/config');

/** معالج 404 لأي مسار غير معرّف. */
function notFound(req, _res, next) {
  next({ status: 404, code: 'http.not_found', message: `المسار غير موجود: ${req.method} ${req.originalUrl}` });
}

/** معالج الأخطاء المركزي (يجب تمريره أخيراً في سلسلة الـ middleware). */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const code = err.code || (status >= 500 ? 'server.error' : 'http.request.invalid');
  const desc = err.message || (status >= 500 ? 'حدث خطأ داخلي في الخادم' : 'طلب غير صالح');

  const body = {
    id: crypto.randomUUID(),
    code,
    desc,
  };
  if (Array.isArray(err.errors) && err.errors.length) body.errors = err.errors;

  // في وضع التطوير نُظهر تتبّع الخطأ لتسهيل التشخيص
  if (config.server.nodeEnv !== 'production' && status >= 500) {
    body.stack = err.stack;
    // eslint-disable-next-line no-console
    console.error('[amana-pay] Unhandled error:', err);
  }

  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
