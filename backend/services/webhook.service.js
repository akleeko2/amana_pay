/**
 * Amana Pay — Webhook Service
 * -----------------------------------------------------------------------------
 * إرسال أحداث الدفع للتاجر (payment.confirmed/expired/failed/review) مع توقيع
 * HMAC، تسجيل كل محاولة في webhook_deliveries، وإعادة محاولة بسيطة.
 */
'use strict';

const crypto = require('crypto');
const db = require('../database/db');
const { nowIso } = require('./_util');

const MAX_ATTEMPTS = 3;

function sign(payloadString, secret) {
  return crypto.createHmac('sha256', secret || 'whsec').update(payloadString).digest('hex');
}

function buildPayload(eventType, payment) {
  return {
    event: eventType,
    timestamp: nowIso(),
    data: {
      paymentId: payment.id,
      orderId: payment.order_id,
      reference: payment.reference,
      amount: payment.dynamic_amount,
      originalAmount: payment.original_amount,
      currency: payment.currency,
      status: payment.status,
      tier: payment.payment_tier,
      matchMode: payment.match_mode,
      confidenceScore: payment.confidence_score,
      confirmedAt: payment.confirmed_at,
    },
  };
}

/**
 * إرسال حدث webhook. يسجّل النتيجة دائماً. لا يرمي (يلتقط الأخطاء داخلياً).
 * @returns {object} سجل التسليم.
 */
async function dispatch(eventType, payment, merchant) {
  const id = crypto.randomUUID();
  const url = merchant && merchant.webhook_url;
  const payload = buildPayload(eventType, payment);
  const payloadString = JSON.stringify(payload);

  const record = {
    id,
    merchant_id: payment.merchant_id,
    payment_request_id: payment.id,
    event_type: eventType,
    url: url || '',
    payload: payloadString,
    status: 'pending',
    attempts: 0,
  };
  db.insert('webhook_deliveries', record);

  if (!url) {
    db.updateById('webhook_deliveries', id, { status: 'failed', status_code: 0, attempts: 0 });
    return { id, status: 'skipped', reason: 'no_webhook_url' };
  }

  const signature = sign(payloadString, merchant.webhook_secret);
  let attempts = 0;
  let lastStatus = 0;

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Amana-Signature': signature,
          'X-Amana-Event': eventType,
        },
        body: payloadString,
        signal: AbortSignal.timeout(5000),
      });
      lastStatus = res.status;
      if (res.ok) {
        db.updateById('webhook_deliveries', id, { status: 'sent', status_code: res.status, attempts });
        return { id, status: 'sent', statusCode: res.status, attempts };
      }
    } catch {
      lastStatus = 0;
    }
  }

  db.updateById('webhook_deliveries', id, { status: 'failed', status_code: lastStatus, attempts });
  return { id, status: 'failed', statusCode: lastStatus, attempts };
}

module.exports = { dispatch, sign, buildPayload };
