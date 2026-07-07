/**
 * Amana Pay — Merchant API Key Authentication
 * -----------------------------------------------------------------------------
 * يحمي مسارات التاجر (/api/v1/*) بمفتاح API يُمرَّر عبر هيدر `x-api-key`
 * (أو `Authorization: Bearer <key>`). يرفق التاجر المُتحقّق منه بـ req.merchant.
 *
 * ملاحظة: هذا مفتاح تاجر Amana Pay، ومنفصل تماماً عن `x-Gateway-APIKey`
 * الخاص بأمان JoPACC (الذي يُدار داخل jopacc-sdk).
 */
'use strict';

const db = require('../database/db');

const API_KEY_HEADER = 'x-api-key';

function extractKey(req) {
  const direct = req.get(API_KEY_HEADER);
  if (direct) return direct.trim();
  const auth = req.get('authorization');
  if (auth && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();
  return null;
}

/** Middleware إلزامي: يرفض الطلب إن لم يوجد مفتاح صالح. */
function requireApiKey(req, res, next) {
  const key = extractKey(req);
  if (!key) {
    return next({ status: 401, code: 'auth.missing_api_key', message: 'API key مفقود (x-api-key).' });
  }

  const merchant = db.merchants.findByApiKey(key);
  if (!merchant) {
    return next({ status: 401, code: 'auth.invalid_api_key', message: 'API key غير صالح.' });
  }
  if (merchant.status !== 'active') {
    return next({ status: 403, code: 'auth.merchant_inactive', message: 'حساب التاجر غير مفعّل.' });
  }

  req.merchant = merchant;
  req.apiKey = key;
  next();
}

/** Middleware اختياري: يرفق التاجر إن وُجد مفتاح، دون رفض الطلب. */
function optionalApiKey(req, _res, next) {
  const key = extractKey(req);
  if (key) {
    const merchant = db.merchants.findByApiKey(key);
    if (merchant && merchant.status === 'active') {
      req.merchant = merchant;
      req.apiKey = key;
    }
  }
  next();
}

module.exports = { requireApiKey, optionalApiKey, API_KEY_HEADER };
