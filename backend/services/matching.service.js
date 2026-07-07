/**
 * Amana Pay — Smart Matching Engine
 * -----------------------------------------------------------------------------
 * محرك مطابقة بوضعين ومستويين (مطابق لـ implementation_plan.md):
 *
 *   الوضع (Mode):  BALANCE_ONLY (اليوم، عبر Balances) ↔ FULL (عند توفّر Transactions)
 *   المستوى (Tier): EXPRESS (بلا موافقة عميل) ↔ VERIFIED (هوية المرسل معزِّز حاسم)
 *
 * هوية المرسل ليست بوابة إلزامية: العوامل الأساسية (مجموعها 100) تكفي للتأكيد،
 * وحجرها المبلغ الديناميكي الفريد. تطابق هوية المرسل يرفع الثقة ويخفّض العتبة.
 *
 * دالة نقية بلا آثار جانبية: تأخذ المدخلات وتُرجع القرار.
 */
'use strict';

const config = require('../config/config');
const { toMs } = require('./_util');

const W = config.matching.fullWeights;
const BW = config.matching.balanceOnlyWeights;
const T = config.matching.thresholds;
const TOL = config.matching.amountToleranceJOD;
const WINDOW = config.matching.timeWindowMs;

/**
 * @param {object} paymentRequest - { dynamicAmount, reference, merchantIBAN, expectedDebtorIBAN?, createdAtMs }
 * @param {object|null} transaction - { amount, reference, debtorAccount, creditorAccount, status, timestampMs } | null
 * @param {object|null} balanceChange - { oldBalance, newBalance, lastModificationDateMs, ambiguous? } | null
 */
function match(paymentRequest, transaction, balanceChange) {
  let score = 0;
  const factors = [];
  const apisUsed = ['Balances'];
  const createdAt = paymentRequest.createdAtMs ?? toMs(paymentRequest.created_at);

  // ===== الوضع الكامل: يتطلب معاملة من Transactions API =====
  if (transaction) {
    apisUsed.push('Transactions', 'Accounts');

    // العوامل الأساسية (Express) — مجموعها 100
    if (Math.abs(transaction.amount - paymentRequest.dynamicAmount) < TOL) {
      score += W.DYNAMIC_AMOUNT;
      factors.push({ factor: 'DYNAMIC_AMOUNT', weight: W.DYNAMIC_AMOUNT, matched: true, source: 'Transactions API' });
    }
    if (transaction.reference && paymentRequest.reference && String(transaction.reference).includes(paymentRequest.reference)) {
      score += W.REFERENCE;
      factors.push({ factor: 'REFERENCE', weight: W.REFERENCE, matched: true, source: 'Transactions API' });
    }
    const txTime = transaction.timestampMs ?? toMs(transaction.bankTimestamp);
    const timeDiff = txTime - createdAt;
    if (timeDiff > 0 && timeDiff < WINDOW) {
      score += W.TIME_WINDOW;
      factors.push({ factor: 'TIME_WINDOW', weight: W.TIME_WINDOW, matched: true, source: 'Transactions API' });
    }
    if (transaction.creditorAccount && transaction.creditorAccount === paymentRequest.merchantIBAN) {
      score += W.MERCHANT_ACCOUNT;
      factors.push({ factor: 'MERCHANT_ACCOUNT', weight: W.MERCHANT_ACCOUNT, matched: true, source: 'Transactions API' });
    }
    if (transaction.status === 'completed') {
      score += W.STATUS;
      factors.push({ factor: 'STATUS', weight: W.STATUS, matched: true, source: 'Transactions API' });
    }
    if (balanceChange) {
      const diff = balanceChange.newBalance - balanceChange.oldBalance;
      if (Math.abs(diff - paymentRequest.dynamicAmount) < TOL) {
        score += W.BALANCE_CHANGE;
        factors.push({ factor: 'BALANCE_CHANGE', weight: W.BALANCE_CHANGE, matched: true, source: 'Balances API' });
      }
    }

    // هوية المرسل: معزِّز حاسم (Verified) — لا يستهلك من الأساس
    let senderVerified = false;
    if (paymentRequest.expectedDebtorIBAN && transaction.debtorAccount === paymentRequest.expectedDebtorIBAN) {
      senderVerified = true;
      factors.push({ factor: 'SENDER_IDENTITY', weight: 'decisive', matched: true, source: 'Consent (Accounts) + Transactions' });
    }

    const decision =
      (senderVerified && score >= T.confirmVerified) || score >= T.confirmExpress
        ? 'CONFIRMED'
        : score >= T.review
        ? 'REVIEW'
        : 'UNMATCHED';

    return { mode: 'FULL', tier: senderVerified ? 'VERIFIED' : 'EXPRESS', score, decision, senderVerified, factors, apisUsed };
  }

  // ===== وضع اليوم (Balance-Only): Balances فقط =====
  if (balanceChange) {
    const diff = balanceChange.newBalance - balanceChange.oldBalance;
    if (Math.abs(diff - paymentRequest.dynamicAmount) < TOL) {
      score += BW.BALANCE_DELTA_MATCH;
      factors.push({ factor: 'BALANCE_DELTA_MATCH', weight: BW.BALANCE_DELTA_MATCH, matched: true, source: 'Balances API' });
    }
    const tChange = balanceChange.lastModificationDateMs ?? toMs(balanceChange.lastModificationDate);
    const timeDiff = tChange - createdAt;
    if (timeDiff > 0 && timeDiff < WINDOW) {
      score += BW.TIME_WINDOW;
      factors.push({ factor: 'TIME_WINDOW', weight: BW.TIME_WINDOW, matched: true, source: 'Balances API (lastModificationDate)' });
    }
  }

  // معالجة الغموض: دلتا متعددة في نفس النافذة → مراجعة لا تأكيد تلقائي
  const decision =
    balanceChange && balanceChange.ambiguous
      ? 'REVIEW'
      : score >= T.confirmExpress
      ? 'CONFIRMED'
      : score >= T.review
      ? 'REVIEW'
      : 'UNMATCHED';

  return { mode: 'BALANCE_ONLY', tier: 'EXPRESS', score, decision, senderVerified: false, factors, apisUsed };
}

module.exports = { match };
