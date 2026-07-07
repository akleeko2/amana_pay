/**
 * Amana Pay — Billing Service (اشتراك SaaS + رسوم مطابقة = الكسر الديناميكي)
 * -----------------------------------------------------------------------------
 * نموذج غير احتجازي: الأموال تذهب مباشرة لحساب التاجر. الإيراد من:
 *   1) اشتراك شهري ثابت حسب الباقة (Starter/Growth/Enterprise).
 *   2) رسوم مطابقة (Matching Fee) على كل حركة مؤكّدة = **نفس الكسر الديناميكي**
 *      الذي دفعه المشتري (مثال: طلب 10.000 → المشتري دفع 10.024 → الرسم = 0.024).
 *      فالمشتري عملياً يغطّي رسم المطابقة، والتاجر يستلم صافي قيمة الطلب.
 *   • باقة Enterprise: بلا رسوم مطابقة (مغطّاة بالاشتراك + ربط ERP).
 *
 * التكلفة المتغيّرة (COGS) = استعلام Open Finance لكل حركة (~5 فلس).
 */
'use strict';

const db = require('../database/db');
const config = require('../config/config');
const { round3 } = require('./_util');

/** إعدادات الباقة لتاجر (مع رجوع افتراضي للباقة الافتراضية). */
function planFor(merchant) {
  const code = (merchant && merchant.plan) || config.billing.defaultPlan;
  return config.billing.plans[code] || config.billing.plans[config.billing.defaultPlan];
}

/** عدد الحركات المؤكدة لهذا التاجر في الشهر الحالي. */
function confirmedThisMonth(merchantId) {
  const row = db.get(
    "SELECT COUNT(*) AS c FROM payment_requests WHERE merchant_id = ? AND status = 'CONFIRMED' " +
      "AND strftime('%Y-%m', confirmed_at) = strftime('%Y-%m','now')",
    [merchantId]
  );
  return row ? row.c : 0;
}

/**
 * رسوم مطابقة حركة مؤكّدة واحدة = الكسر الديناميكي الذي دفعه المشتري (بالضبط، بالفلس).
 * Enterprise (unlimited): بلا رسوم.
 * @param {object} merchant - سجل التاجر (يحتوي plan)
 * @param {object} payment - صف الدفع (dynamic_amount, original_amount)
 * @returns {{ fee: number, included: boolean, plan: string }}
 */
function computeMatchingFee(merchant, payment) {
  const plan = planFor(merchant);
  if (plan.unlimited) {
    return { fee: 0, included: true, plan: plan.code };
  }
  const fraction = round3((payment.dynamic_amount || 0) - (payment.original_amount || 0));
  const fee = fraction > 0 ? fraction : 0; // بالضبط بالفلس
  return { fee, included: false, plan: plan.code };
}

/** ملخص الفوترة الشهري لتاجر (للوحة التحكم). */
function monthlySummary(merchant) {
  const plan = planFor(merchant);
  const row = db.get(
    "SELECT COUNT(*) AS confirmed, COALESCE(SUM(commission_amount),0) AS matching_fees, " +
      "COALESCE(SUM(original_amount),0) AS volume, COALESCE(SUM(dynamic_amount),0) AS volume_received " +
      "FROM payment_requests WHERE merchant_id = ? AND status = 'CONFIRMED' " +
      "AND strftime('%Y-%m', confirmed_at) = strftime('%Y-%m','now')",
    [merchant.id]
  );
  const confirmed = row ? row.confirmed : 0;
  const matchingFeesDue = round3(row ? row.matching_fees : 0);
  const feeApplies = !plan.unlimited;
  const avgFeePerTx = confirmed > 0 && feeApplies ? round3(matchingFeesDue / confirmed) : 0;

  // التكلفة المتغيّرة والصافي (شفافية داخلية)
  const variableCost = round3(confirmed * config.billing.costPerApiQueryJOD);
  const totalDue = round3(plan.monthlyFee + matchingFeesDue);

  return {
    plan: plan.code,
    planName: plan.name,
    planNameAr: plan.name_ar,
    monthlyFee: plan.monthlyFee,
    unlimited: plan.unlimited,
    feeApplies, // هل تُطبَّق رسوم مطابقة على الحركات؟ (Enterprise = false)
    erpIntegration: plan.erpIntegration,
    confirmedCount: confirmed,
    matchingFeesDue, // مجموع الكسور بالضبط (بالفلس)
    avgFeePerTx,
    volume: round3(row ? row.volume : 0), // قيمة الطلبات (الأصلية)
    volumeReceived: round3(row ? row.volume_received : 0), // ما وصل فعلاً للتاجر (الديناميكي)
    subscriptionDue: plan.monthlyFee,
    totalDue, // = الاشتراك + رسوم المطابقة
    variableCost,
    estimatedNetProfit: round3(totalDue - variableCost),
  };
}

/** قائمة الباقات المتاحة (للتسعير في الواجهات). */
function listPlans() {
  return Object.values(config.billing.plans);
}

module.exports = {
  planFor,
  confirmedThisMonth,
  computeMatchingFee,
  monthlySummary,
  listPlans,
};
