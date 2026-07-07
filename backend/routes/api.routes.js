/**
 * Amana Pay — Merchant REST API (/api/v1)
 * -----------------------------------------------------------------------------
 * مسارات التاجر العامة. التسجيل وبدء الموافقة عامّان؛ بقية المسارات محمية
 * بمفتاح API (requireApiKey).
 */
'use strict';

const express = require('express');
const { requireApiKey } = require('../middleware/auth');
const merchantService = require('../services/merchant.service');
const paymentService = require('../services/payment.service');
const consentService = require('../services/consent.service');
const billing = require('../services/billing.service');
const sdk = require('../jopacc-sdk');
const db = require('../database/db');

const router = express.Router();

/** غلاف async موحّد لتمرير الأخطاء إلى معالج الأخطاء المركزي. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// -----------------------------------------------------------------------------
// التجار
// -----------------------------------------------------------------------------

// POST /api/v1/merchants/register — تسجيل تاجر (IBAN/accountId → auto-lookup)
router.post(
  '/merchants/register',
  wrap(async (req, res) => {
    const { name, name_ar, email, lookupValue, lookupSchema, nid, webhook_url, plan } = req.body || {};
    const merchant = await merchantService.register({ name, name_ar, email, lookupValue, lookupSchema, nid, webhook_url, plan });
    // نُرجع api_key مرة واحدة فقط عند التسجيل
    res.status(201).json({
      merchant: merchantService.publicView(merchant),
      apiKey: merchant.api_key,
    });
  })
);

// GET /api/v1/plans — الباقات المتاحة (تسعير عام، بلا مصادقة)
router.get('/plans', (_req, res) => {
  res.json({ plans: billing.listPlans(), defaultPlan: require('../config/config').billing.defaultPlan });
});

// GET /api/v1/merchants/me — بيانات التاجر الحالي
router.get(
  '/merchants/me',
  requireApiKey,
  wrap(async (req, res) => {
    res.json({ merchant: merchantService.publicView(req.merchant) });
  })
);

// GET /api/v1/merchants/verify — تحقق من حساب التاجر (IBAN Confirmation)
router.get(
  '/merchants/verify',
  requireApiKey,
  wrap(async (req, res) => {
    const result = await merchantService.verify(req.merchant);
    res.json({ verification: result });
  })
);

// -----------------------------------------------------------------------------
// الموافقة (العميل)
// -----------------------------------------------------------------------------

// POST /api/v1/merchants/consent/initiate — بدء تدفق موافقة العميل
router.post(
  '/merchants/consent/initiate',
  requireApiKey,
  wrap(async (req, res) => {
    const { phone } = req.body || {};
    if (!phone) {
      const e = new Error('رقم الهاتف مطلوب');
      e.status = 400;
      e.code = 'consent.phone_required';
      throw e;
    }
    const existing = consentService.findReusable(phone);
    if (existing) return res.json({ reused: true, consent: { id: existing.id, status: existing.status, expiresAt: existing.expires_at } });
    res.json({ reused: false, ...consentService.initiate(phone) });
  })
);

// POST /api/v1/merchants/consent/callback — إتمام الموافقة (بعد موافقة العميل)
router.post(
  '/merchants/consent/callback',
  wrap(async (req, res) => {
    const { consentId, phone } = req.body || {};
    if (!consentId || !phone) {
      const e = new Error('consentId و phone مطلوبان');
      e.status = 400;
      e.code = 'consent.invalid_callback';
      throw e;
    }
    const consent = await consentService.authorize(consentId, phone);
    res.json({
      consent: { id: consent.id, status: consent.status, customerName: consent.customer_name, expiresAt: consent.expires_at },
    });
  })
);

// -----------------------------------------------------------------------------
// المدفوعات
// -----------------------------------------------------------------------------

// POST /api/v1/payments — إنشاء طلب دفع (مع pre-payment validation)
router.post(
  '/payments',
  requireApiKey,
  wrap(async (req, res) => {
    const { amount, originalAmount, orderId, customerPhone, description } = req.body || {};
    const payment = await paymentService.createPayment(req.merchant, {
      originalAmount: Number(originalAmount ?? amount),
      orderId,
      customerPhone,
      description,
    });
    res.status(201).json({ payment: paymentService.paymentPageView(payment) });
  })
);

// GET /api/v1/payments — قائمة طلبات الدفع
router.get(
  '/payments',
  requireApiKey,
  wrap(async (req, res) => {
    let list = paymentService.listByMerchant(req.merchant.id);
    if (req.query.status) list = list.filter((p) => p.status === String(req.query.status).toUpperCase());
    res.json({ payments: list.map(paymentService.paymentPageView) });
  })
);

// GET /api/v1/payments/:id — حالة طلب دفع
router.get(
  '/payments/:id',
  requireApiKey,
  wrap(async (req, res) => {
    const p = paymentService.getPayment(req.params.id);
    if (!p || p.merchant_id !== req.merchant.id) {
      const e = new Error('طلب الدفع غير موجود');
      e.status = 404;
      e.code = 'payment.not_found';
      throw e;
    }
    res.json({ payment: paymentService.paymentPageView(p) });
  })
);

// POST /api/v1/payments/:id/cancel — إلغاء طلب
router.post(
  '/payments/:id/cancel',
  requireApiKey,
  wrap(async (req, res) => {
    const p = paymentService.cancelPayment(req.params.id, req.merchant.id);
    res.json({ payment: paymentService.paymentPageView(p) });
  })
);

// -----------------------------------------------------------------------------
// المعاملات / الرسوم / الإحصائيات
// -----------------------------------------------------------------------------

// GET /api/v1/transactions — قائمة المعاملات
router.get(
  '/transactions',
  requireApiKey,
  wrap(async (req, res) => {
    const txs = db.transactions.listByMerchant(req.merchant.id);
    res.json({ transactions: txs });
  })
);

// GET /api/v1/fees — رسوم الخدمة (SSTs اليوم؛ CliQ عند توفّره)
router.get(
  '/fees',
  requireApiKey,
  wrap(async (req, res) => {
    const service = req.query.service;
    const result = service ? await sdk.fees.getServiceFees(String(service)) : await sdk.fees.getCliQFees();
    res.json({ fees: result.data });
  })
);

// GET /api/v1/stats — إحصائيات + ملخص الفوترة الشهري
router.get(
  '/stats',
  requireApiKey,
  wrap(async (req, res) => {
    const list = paymentService.listByMerchant(req.merchant.id);
    const count = (s) => list.filter((p) => p.status === s).length;
    res.json({
      stats: {
        total: list.length,
        confirmed: count('CONFIRMED'),
        pending: count('PENDING') + count('PROCESSING'),
        expired: count('EXPIRED'),
        cancelled: count('CANCELLED'),
        review: list.filter((p) => p.match_mode && p.status === 'PROCESSING').length,
      },
      billing: billing.monthlySummary(req.merchant),
    });
  })
);

module.exports = router;
