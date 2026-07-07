/**
 * Amana Pay — Demo / Simulation Service
 * -----------------------------------------------------------------------------
 * يحاكي وصول دفعة CliQ في العرض التقديمي: يحقن معاملة في حساب التاجر
 * (Transactions) ويطبّق تغيّر الرصيد المقابل (Balances)، فيلتقطها الـ Poller
 * تلقائياً → Smart Match → Confirm.
 *
 * المرجع: implementation_plan.md (المكون 4).
 */
'use strict';

const sdk = require('../jopacc-sdk');
const db = require('../database/db');
const polling = require('./polling.service');

/**
 * محاكاة دفع لطلب معيّن.
 * @param {string} paymentRequestId
 * @param {object} [opts] - { fromIban?, fromName?, fromBic?, useReference=true, exactAmount=true }
 */
async function simulatePayment(paymentRequestId, opts = {}) {
  const payment = db.payments.findById(paymentRequestId);
  if (!payment) {
    const e = new Error('طلب الدفع غير موجود');
    e.status = 404;
    e.code = 'payment.not_found';
    throw e;
  }
  if (!['PENDING', 'PROCESSING'].includes(payment.status)) {
    const e = new Error('طلب الدفع ليس في حالة قابلة للدفع');
    e.status = 409;
    e.code = 'payment.not_payable';
    throw e;
  }

  const merchant = db.merchants.findById(payment.merchant_id);
  const accountId = merchant.jopacc_account_id;

  // هوية المرسل: من الموافقة المتوقعة (Verified) أو افتراضية (Express)
  const debtor = {
    name: opts.fromName || payment.expected_debtor_name || 'Ahmad Mohammad Al-Saleh',
    iban: opts.fromIban || payment.expected_debtor_iban || 'JO11ARAB1234000000000123456789',
    bic: opts.fromBic || 'ARABJOAX',
  };

  const amount = opts.exactAmount === false ? payment.dynamic_amount + 0.005 : payment.dynamic_amount;
  const reference = opts.useReference === false ? null : payment.reference;

  // 1. حقن معاملة CliQ واردة (Transactions API)
  const injected = sdk.transactions.injectTransaction(accountId, {
    amount,
    reference,
    debtor,
    creditor: { name: merchant.account_name, iban: merchant.iban },
    currency: payment.currency,
  });

  // 2. تطبيق تغيّر الرصيد المقابل (Balances API)
  sdk._store.applyBalanceDelta(accountId, amount);

  db.audit.log({
    merchantId: merchant.id,
    entityType: 'payment',
    entityId: payment.id,
    action: 'demo_payment_injected',
    details: JSON.stringify({ amount, reference, debtorIban: debtor.iban }),
    jopaccApi: 'Transactions(inject) + Balances(delta)',
  });

  // 3. تشغيل دورة استطلاع فورية لالتقاط الدفعة (بدل انتظار المؤقت)
  const result = await polling.processOnce();

  return {
    injectedTransaction: injected,
    pollResult: result,
    payment: db.payments.findById(payment.id),
  };
}

module.exports = { simulatePayment };
