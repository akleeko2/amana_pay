/**
 * Amana Pay — Payment Service
 * -----------------------------------------------------------------------------
 * إنشاء/إدارة طلبات الدفع: المبلغ الديناميكي الفريد + المرجع + التحقق المسبق
 * + الرسوم المتوقعة + baseline الرصيد + دعم مستويي Express/Verified.
 */
'use strict';

const crypto = require('crypto');
const sdk = require('../jopacc-sdk');
const db = require('../database/db');
const config = require('../config/config');
const verification = require('./verification.service');
const consentService = require('./consent.service');
const { round3, nowIso, safeParse } = require('./_util');

// -----------------------------------------------------------------------------
// توليد المبلغ الديناميكي والمرجع (مطابق للخطة)
// -----------------------------------------------------------------------------
function generateDynamicAmount(originalAmount) {
  const { dynamicFractionMin: lo, dynamicFractionMax: hi, dynamicFractionDivisor: div } = config.payments;
  const fraction = Math.floor(Math.random() * (hi - lo + 1)) + lo; // 1..99
  return round3(originalAmount + fraction / div);
}

function generateReference() {
  const num = Math.floor(1000 + Math.random() * 9000);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const suffix = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${config.payments.referencePrefix}-${num}-${suffix}`;
}

/** توليد مبلغ ديناميكي فريد لا يتعارض مع طلب معلّق آخر لنفس التاجر. */
function uniqueDynamicAmount(merchantId, originalAmount) {
  const pending = db.payments
    .listByMerchant(merchantId)
    .filter((p) => ['PENDING', 'PROCESSING'].includes(p.status))
    .map((p) => p.dynamic_amount);
  let amount;
  let tries = 0;
  do {
    amount = generateDynamicAmount(originalAmount);
    tries += 1;
  } while (pending.includes(amount) && tries < 200);
  return amount;
}

/** توليد مرجع فريد عالمياً. */
function uniqueReference() {
  let ref;
  let tries = 0;
  do {
    ref = generateReference();
    tries += 1;
  } while (db.payments.findByReference(ref) && tries < 200);
  return ref;
}

/**
 * إنشاء طلب دفع.
 * @param {object} merchant - سجل التاجر
 * @param {object} p - { originalAmount, orderId?, customerPhone?, description?, tier? }
 */
async function createPayment(merchant, { originalAmount, orderId, customerPhone, description, returnUrl } = {}) {
  if (!(originalAmount > 0)) {
    const e = new Error('المبلغ يجب أن يكون أكبر من صفر');
    e.status = 400;
    e.code = 'payment.invalid_amount';
    throw e;
  }

  // 1. تحقق قبل الدفع: الحساب فعّال ويقبل تحويلات + baseline الرصيد
  const pre = await verification.prePaymentCheck(merchant);

  // 2. هوية العميل المتوقعة (Verified) إن وُجدت موافقة سارية
  let tier = 'EXPRESS';
  let identity = {};
  if (customerPhone) {
    const consent = consentService.findReusable(customerPhone);
    if (consent) {
      tier = 'VERIFIED';
      identity = consentService.identityFromConsent(consent);
    }
  }

  // 3. الرسوم المتوقعة (إن توفّرت لرسوم الخدمة)
  let estimatedFee = 0;
  try {
    const fees = await sdk.fees.getCliQFees();
    const incoming = (fees.data || []).find((f) => f.service && f.service.includes('incoming'));
    if (incoming && incoming.fees && incoming.fees[0]) estimatedFee = Number(incoming.fees[0].feeAmount.amount) || 0;
  } catch {
    estimatedFee = 0;
  }

  const dynamicAmount = uniqueDynamicAmount(merchant.id, originalAmount);
  const reference = uniqueReference();
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + config.payments.expiryMs).toISOString();

  const row = {
    id,
    merchant_id: merchant.id,
    order_id: orderId || null,
    original_amount: round3(originalAmount),
    dynamic_amount: dynamicAmount,
    currency: config.payments.currency,
    estimated_fee: round3(estimatedFee),
    estimated_net: round3(originalAmount - estimatedFee),
    reference,
    cliq_alias: merchant.cliq_alias,
    bank_name: merchant.bank_name,
    account_name: merchant.account_name,
    expected_debtor_phone: identity.expected_debtor_phone || customerPhone || null,
    expected_debtor_account_id: identity.expected_debtor_account_id || null,
    expected_debtor_iban: identity.expected_debtor_iban || null,
    expected_debtor_name: identity.expected_debtor_name || null,
    payment_tier: tier,
    pre_check_status: pre.verified ? 'passed' : 'failed',
    pre_check_locked_for_credit: pre.lockedForCredit ? 1 : 0,
    balance_before: pre.currentBalance,
    status: 'PENDING',
    expires_at: expiresAt,
    created_at: nowIso(),
    customer_name: identity.expected_debtor_name || null,
    description: description || null,
    return_url: returnUrl || null,
  };

  db.insert('payment_requests', row);
  db.audit.log({ merchantId: merchant.id, entityType: 'payment', entityId: id, action: 'created', details: JSON.stringify({ tier, dynamicAmount, reference }) });

  return db.payments.findById(id);
}

function getPayment(id) {
  return db.payments.findById(id);
}

function listByMerchant(merchantId) {
  return db.payments.listByMerchant(merchantId);
}

/** إلغاء طلب دفع (إن كان معلّقاً). */
function cancelPayment(id, merchantId) {
  const p = db.payments.findById(id);
  if (!p || p.merchant_id !== merchantId) {
    const e = new Error('طلب الدفع غير موجود');
    e.status = 404;
    e.code = 'payment.not_found';
    throw e;
  }
  if (!['PENDING', 'PROCESSING'].includes(p.status)) {
    const e = new Error('لا يمكن إلغاء طلب غير معلّق');
    e.status = 409;
    e.code = 'payment.not_cancellable';
    throw e;
  }
  db.updateById('payment_requests', id, { status: 'CANCELLED' });
  db.audit.log({ merchantId, entityType: 'payment', entityId: id, action: 'cancelled' });
  return db.payments.findById(id);
}

/** تحويل صف الدفع إلى مدخلات محرك المطابقة. */
function toMatchInput(p) {
  return {
    id: p.id,
    dynamicAmount: p.dynamic_amount,
    reference: p.reference,
    merchantIBAN: p.iban || null,
    expectedDebtorIBAN: p.expected_debtor_iban || null,
    createdAtMs: new Date(p.created_at).getTime(),
  };
}

/** عرض صفحة الدفع (بيانات آمنة للعميل). */
function paymentPageView(p) {
  if (!p) return null;
  return {
    id: p.id,
    status: p.status,
    tier: p.payment_tier,
    amount: p.dynamic_amount,
    originalAmount: p.original_amount,
    currency: p.currency,
    reference: p.reference,
    cliqAlias: p.cliq_alias,
    bankName: p.bank_name,
    accountName: p.account_name,
    customerName: p.customer_name,
    estimatedFee: p.estimated_fee,
    expiresAt: p.expires_at,
    confirmedAt: p.confirmed_at,
    matchFactors: safeParse(p.match_factors, []),
    matchMode: p.match_mode,
    confidenceScore: p.confidence_score,
    returnUrl: p.return_url || null,
  };
}

module.exports = {
  generateDynamicAmount,
  generateReference,
  createPayment,
  getPayment,
  listByMerchant,
  cancelPayment,
  toMatchInput,
  paymentPageView,
};
