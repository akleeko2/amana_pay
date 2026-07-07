/**
 * Amana Pay — Payment Page API (/api/v1/payment-page)
 * -----------------------------------------------------------------------------
 * مسارات عامة (بلا مفتاح API) تستهلكها صفحة دفع العميل:
 *  - عرض بيانات الطلب
 *  - استطلاع الحالة (polling)
 *  - مساري Express / Verified للعميل (موافقة لمرة واحدة + إعادة استخدام صامت + CAF)
 */
'use strict';

const express = require('express');
const paymentService = require('../services/payment.service');
const consentService = require('../services/consent.service');
const db = require('../database/db');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function loadPayment(id) {
  const p = db.payments.findById(id);
  if (!p) {
    const e = new Error('طلب الدفع غير موجود');
    e.status = 404;
    e.code = 'payment.not_found';
    throw e;
  }
  return p;
}

// GET /api/v1/payment-page/:id — بيانات صفحة الدفع
router.get(
  '/payment-page/:id',
  wrap(async (req, res) => {
    const p = loadPayment(req.params.id);
    res.json({ payment: paymentService.paymentPageView(p) });
  })
);

// GET /api/v1/payment-page/:id/status — حالة الدفع (polling خفيف)
router.get(
  '/payment-page/:id/status',
  wrap(async (req, res) => {
    const p = loadPayment(req.params.id);
    res.json({
      id: p.id,
      status: p.status,
      tier: p.payment_tier,
      confirmedAt: p.confirmed_at,
      confidenceScore: p.confidence_score,
      matchMode: p.match_mode,
    });
  })
);

// POST /api/v1/payment-page/:id/identify — العميل يُدخل هاتفه (Express أو فحص Verified)
// يُرجع ما إذا كان لدى العميل موافقة سارية (Verified) أم سيُكمل عبر Express.
router.post(
  '/payment-page/:id/identify',
  wrap(async (req, res) => {
    const p = loadPayment(req.params.id);
    const { phone } = req.body || {};
    if (!phone) {
      const e = new Error('رقم الهاتف مطلوب');
      e.status = 400;
      e.code = 'payment.phone_required';
      throw e;
    }

    const consent = consentService.findReusable(phone);
    if (consent) {
      // العميل العائد: ربط الهوية المتوقعة + فحص الرصيد (CAF) بلا redirect
      const identity = consentService.identityFromConsent(consent);
      const caf = await consentService.checkCustomerFunds(consent, p.dynamic_amount);
      db.updateById('payment_requests', p.id, {
        payment_tier: 'VERIFIED',
        expected_debtor_phone: identity.expected_debtor_phone,
        expected_debtor_account_id: identity.expected_debtor_account_id,
        expected_debtor_iban: identity.expected_debtor_iban,
        expected_debtor_name: identity.expected_debtor_name,
        customer_name: identity.expected_debtor_name,
      });
      return res.json({
        tier: 'VERIFIED',
        reused: true,
        customerName: consent.customer_name,
        fundsAvailable: caf ? caf.fundsAvailable : null,
      });
    }

    // لا توجد موافقة: نتيح Express مباشرة، أو بدء موافقة لمرة واحدة (Verified)
    db.updateById('payment_requests', p.id, { expected_debtor_phone: phone, payment_tier: 'EXPRESS' });
    const init = consentService.initiate(phone);
    res.json({ tier: 'EXPRESS', reused: false, consentOption: init });
  })
);

// POST /api/v1/payment-page/:id/consent-callback — إتمام موافقة العميل (Verified لأول مرة)
router.post(
  '/payment-page/:id/consent-callback',
  wrap(async (req, res) => {
    const p = loadPayment(req.params.id);
    const { consentId, phone } = req.body || {};
    if (!consentId || !phone) {
      const e = new Error('consentId و phone مطلوبان');
      e.status = 400;
      e.code = 'consent.invalid_callback';
      throw e;
    }
    const consent = await consentService.authorize(consentId, phone);
    const identity = consentService.identityFromConsent(consent);
    const caf = await consentService.checkCustomerFunds(consent, p.dynamic_amount);
    db.updateById('payment_requests', p.id, {
      payment_tier: 'VERIFIED',
      expected_debtor_phone: identity.expected_debtor_phone,
      expected_debtor_account_id: identity.expected_debtor_account_id,
      expected_debtor_iban: identity.expected_debtor_iban,
      expected_debtor_name: identity.expected_debtor_name,
      customer_name: identity.expected_debtor_name,
    });
    res.json({ tier: 'VERIFIED', customerName: consent.customer_name, fundsAvailable: caf ? caf.fundsAvailable : null });
  })
);

module.exports = router;
