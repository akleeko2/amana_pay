/**
 * Amana Pay — Dual Poller (Balances + Transactions)
 * -----------------------------------------------------------------------------
 * يراقب طلبات الدفع المعلّقة ويكتشف الدفعات الواردة على حساب التاجر:
 *  - Transactions API (FULL): مطابقة كل معاملة بمبلغها الديناميكي مستقلة.
 *  - Balances API (BALANCE_ONLY): فرق الرصيد = المبلغ الديناميكي الفريد.
 * يعالج الدلتا المتعددة في نفس النافذة (ambiguous → REVIEW)، ويُنهي المنتهية.
 *
 * عند التأكيد: يحسب العمولة + يسجّل المعاملة + يرسل webhook + يبث تحديثاً حياً.
 */
'use strict';

const crypto = require('crypto');
const sdk = require('../jopacc-sdk');
const db = require('../database/db');
const config = require('../config/config');
const matching = require('./matching.service');
const billing = require('./billing.service');
const webhook = require('./webhook.service');
const paymentService = require('./payment.service');
const realtime = require('../realtime');
const { round3, toMs, nowIso } = require('./_util');

const TOL = config.matching.amountToleranceJOD;
let timer = null;

/** هل استُهلكت هذه المعاملة البنكية مسبقاً (طوبّقت بطلب)؟ */
function isConsumed(bankTxId) {
  return !!db.get('SELECT id FROM transactions WHERE bank_transaction_id = ?', [bankTxId]);
}

/** تحويل معاملة SDK إلى مدخلات المطابقة. */
function toTxInput(tx) {
  return {
    amount: tx.amount,
    reference: tx.reference,
    debtorAccount: tx.debtorAccount,
    creditorAccount: tx.creditorAccount,
    status: tx.status,
    timestampMs: toMs(tx.bankTimestamp),
  };
}

/** دورة استطلاع واحدة (قابلة للاستدعاء يدوياً في الاختبارات). */
async function processOnce() {
  expireOld();

  const pendings = db.payments.listPending();
  if (!pendings.length) return { processed: 0, confirmed: 0 };

  // تجميع حسب التاجر
  const byMerchant = new Map();
  for (const p of pendings) {
    if (!byMerchant.has(p.merchant_id)) byMerchant.set(p.merchant_id, []);
    byMerchant.get(p.merchant_id).push(p);
  }

  let confirmed = 0;
  for (const [merchantId, payments] of byMerchant) {
    const merchant = db.merchants.findById(merchantId);
    if (!merchant || !merchant.jopacc_account_id) continue;

    // 1. الرصيد الحالي
    let current = merchant.last_known_balance;
    let lastModMs = 0;
    try {
      const { balance } = await sdk.balances.getBalance(merchant.jopacc_account_id);
      current = balance.availableBalance.balanceAmount;
      lastModMs = toMs(balance.lastModificationDate);
    } catch {
      /* تجاهل خطأ الرصيد المؤقت */
    }

    let baseline = merchant.last_known_balance != null ? merchant.last_known_balance : current;
    const delta = round3(current - baseline);

    // 2. المعاملات (FULL إن توفّرت)
    let txs = [];
    try {
      const txResp = await sdk.transactions.listTransactions(merchant.jopacc_account_id);
      txs = (txResp.data || []).filter((t) => !isConsumed(t.transactionId));
    } catch {
      txs = [];
    }

    // كشف الغموض في وضع Balance-Only: كم طلب معلّق يطابق الدلتا؟
    const deltaMatches = payments.filter((p) => Math.abs(p.dynamic_amount - delta) < TOL);
    const ambiguous = deltaMatches.length > 1;

    for (const p of payments) {
      // FULL: ابحث عن معاملة غير مستهلكة تطابق المبلغ الديناميكي
      const tx = txs.find((t) => Math.abs(t.amount - p.dynamic_amount) < TOL);

      const balanceChange =
        delta > 0
          ? { oldBalance: baseline, newBalance: current, lastModificationDateMs: lastModMs, ambiguous }
          : null;

      if (!tx && !balanceChange) continue;

      const result = matching.match(
        paymentService.toMatchInput(p),
        tx ? toTxInput(tx) : null,
        balanceChange
      );

      if (result.decision === 'CONFIRMED') {
        await settle(p, merchant, tx, result, current);
        confirmed += 1;
        if (tx) txs.splice(txs.indexOf(tx), 1); // استهلاك المعاملة
        baseline = current; // إعادة ضبط الأساس بعد التأكيد
      } else if (result.decision === 'REVIEW' && p.status !== 'REVIEW') {
        db.updateById('payment_requests', p.id, {
          status: 'PROCESSING',
          confidence_score: result.score,
          match_factors: JSON.stringify(result.factors),
          match_mode: result.mode,
        });
        realtime.broadcast(`payment:${p.id}`, 'payment.processing', { id: p.id, score: result.score });
      }
    }

    // تحديث أساس الرصيد للتاجر
    db.updateById('merchants', merchant.id, { last_known_balance: current, last_balance_check: nowIso() });
  }

  return { processed: pendings.length, confirmed };
}

/** تثبيت الدفع المؤكد: عمولة + سجل معاملة + webhook + بث حي. */
async function settle(payment, merchant, tx, result, currentBalance) {
  // رسوم المطابقة على التاجر = الكسر الديناميكي الذي دفعه المشتري (بالضبط، بالفلس)
  // Enterprise: بلا رسوم مطابقة (included).
  const { fee, included } = billing.computeMatchingFee(merchant, payment);

  db.updateById('payment_requests', payment.id, {
    status: 'CONFIRMED',
    confirmed_at: nowIso(),
    confidence_score: result.score,
    match_factors: JSON.stringify(result.factors),
    match_mode: result.mode,
    apis_used: JSON.stringify(result.apisUsed),
    matched_transaction_id: tx ? tx.transactionId : null,
    balance_after: currentBalance,
    commission_amount: fee,
    is_free_tier: included ? 1 : 0,
  });

  // سجل المعاملة (من Transactions أو من كشف الرصيد)
  db.insert('transactions', {
    id: crypto.randomUUID(),
    merchant_id: merchant.id,
    bank_transaction_id: tx ? tx.transactionId : `bal_${payment.id}`,
    payment_request_id: payment.id,
    amount: tx ? tx.amount : payment.dynamic_amount,
    currency: payment.currency,
    reference: tx ? tx.reference : payment.reference,
    transaction_type: 'CliQ_CREDIT',
    status: 'completed',
    debtor_name: tx ? tx.debtorName : null,
    debtor_iban: tx ? tx.debtorAccount : null,
    creditor_iban: tx ? tx.creditorAccount : merchant.iban,
    creditor_name: merchant.account_name,
    match_status: 'MATCHED',
    confidence_score: result.score,
    match_factors: JSON.stringify(result.factors),
    detection_source: tx ? 'transactions' : 'balances',
    bank_timestamp: tx ? tx.bankTimestamp : nowIso(),
  });

  db.audit.log({
    merchantId: merchant.id,
    entityType: 'payment',
    entityId: payment.id,
    action: 'confirmed',
    details: JSON.stringify({ mode: result.mode, tier: result.tier, score: result.score, matchingFee: fee, included }),
    jopaccApi: result.apisUsed.join(','),
  });

  const updated = db.payments.findById(payment.id);
  realtime.broadcast(`payment:${payment.id}`, 'payment.confirmed', paymentService.paymentPageView(updated));
  realtime.broadcast(`merchant:${merchant.id}`, 'payment.confirmed', { paymentId: payment.id });

  await webhook.dispatch('payment.confirmed', updated, merchant);
}

/** إنهاء الطلبات المنتهية الصلاحية. */
function expireOld() {
  const expired = db.payments.listExpired();
  for (const p of expired) {
    db.updateById('payment_requests', p.id, { status: 'EXPIRED' });
    db.audit.log({ merchantId: p.merchant_id, entityType: 'payment', entityId: p.id, action: 'expired' });
    realtime.broadcast(`payment:${p.id}`, 'payment.expired', { id: p.id });
    const merchant = db.merchants.findById(p.merchant_id);
    if (merchant) webhook.dispatch('payment.expired', { ...p, status: 'EXPIRED' }, merchant);
  }
  return expired.length;
}

function start() {
  if (timer) return;
  timer = setInterval(() => {
    processOnce().catch((e) => console.error('[poller] error:', e.message));
  }, config.matching.pollIntervalMs);
  if (timer.unref) timer.unref();
  console.log(`[poller] started (every ${config.matching.pollIntervalMs}ms)`);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { start, stop, processOnce, expireOld };
