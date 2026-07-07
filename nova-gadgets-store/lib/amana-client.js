/**
 * Nova Gadgets — عميل حقيقي لبوابة الدفع Amana Pay
 * -----------------------------------------------------------------------------
 * يستهلك REST API الموثّق في docs/API.md فعلياً عبر HTTP (fetch)، بالضبط كما
 * يفعل أي متجر خارجي حقيقي: تسجيل تاجر مرة واحدة، ثم إنشاء طلبات دفع بمفتاح API.
 */
'use strict';

const config = require('../config');

const BASE = `${config.amanaPayUrl}/api/v1`;

let apiKeyCache = null;

async function request(method, path, { body, apiKey, allowFail = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch { /* no body */ }

  if (!res.ok && !allowFail) {
    const desc = (data && data.desc) || `Amana Pay request failed (${res.status})`;
    const err = new Error(desc);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return { status: res.status, data };
}

/**
 * تسجيل المتجر لدى Amana Pay (مرة واحدة). إن كان مسجّلاً مسبقاً (البريد مستخدم)،
 * نتعامل مع الخطأ بلطف ونطلب من المشغّل تزويد مفتاح API عبر متغيّر بيئة بدلاً من ذلك.
 */
async function registerStore() {
  // نمرّر المفتاح الثابت (إن وُجد) ليُنشَأ التاجر بنفس المفتاح دائماً — يثبّت المفتاح
  // عبر إعادة التشغيل ويغلق سباق الإقلاع بين المتجر والبوابة.
  const body = { ...config.merchant };
  if (process.env.STORE_API_KEY) body.apiKey = process.env.STORE_API_KEY;

  const { status, data } = await request('POST', '/merchants/register', {
    body,
    allowFail: true,
  });

  if (status === 201) {
    apiKeyCache = data.apiKey;
    return { merchant: data.merchant, apiKey: data.apiKey, freshlyRegistered: true };
  }

  if (status === 409) {
    throw new Error(
      'المتجر مسجّل مسبقاً لدى Amana Pay بهذا البريد. زوّد متغيّر البيئة STORE_API_KEY بمفتاح API الحالي، أو غيّر STORE_EMAIL لتسجيل جديد.'
    );
  }

  throw new Error((data && data.desc) || 'تعذّر تسجيل المتجر لدى Amana Pay.');
}

/** يستخدم مفتاح API من متغيّر البيئة إن وُجد، وإلا يسجّل المتجر تلقائياً. */
async function ensureRegistered() {
  if (process.env.STORE_API_KEY) {
    apiKeyCache = process.env.STORE_API_KEY;
    // تحقق أن المفتاح صالح فعلاً
    const check = await request('GET', '/merchants/me', { apiKey: apiKeyCache, allowFail: true });
    if (check.status === 200) return { merchant: check.data.merchant, apiKey: apiKeyCache, freshlyRegistered: false };
    // eslint-disable-next-line no-console
    console.warn('[nova-gadgets] STORE_API_KEY غير صالح، سيتم التسجيل من جديد...');
  }
  return registerStore();
}

function apiKey() {
  if (!apiKeyCache) throw new Error('المتجر غير مسجّل لدى Amana Pay بعد.');
  return apiKeyCache;
}

/** يضمن وجود مفتاح API (تسجيل كسول إن لم يكن الإقلاع قد سجّل بعد). */
async function ensureApiKey() {
  if (apiKeyCache) return apiKeyCache;
  await ensureRegistered();
  return apiKey();
}

/** إنشاء طلب دفع حقيقي لدى Amana Pay مقابل طلب شراء في المتجر. */
async function createPayment({ amount, orderId, customerPhone, description }) {
  const key = await ensureApiKey();
  const { data } = await request('POST', '/payments', {
    apiKey: key,
    body: { amount, orderId, customerPhone, description },
  });
  return data.payment;
}

/** جلب حالة طلب دفع. */
async function getPayment(paymentId) {
  const key = await ensureApiKey();
  const { data } = await request('GET', `/payments/${paymentId}`, { apiKey: key });
  return data.payment;
}

/** رابط صفحة الدفع الحقيقية (المستهلك يفتحه في المتصفح). */
function paymentPageUrl(paymentId, returnUrl) {
  const u = new URL('/payment-page/index.html', config.amanaPayUrl);
  u.searchParams.set('id', paymentId);
  if (returnUrl) u.searchParams.set('return', returnUrl);
  return u.toString();
}

module.exports = { ensureRegistered, createPayment, getPayment, paymentPageUrl, apiKey };
