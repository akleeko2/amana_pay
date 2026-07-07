/**
 * Nova Gadgets — إعدادات المتجر
 * -----------------------------------------------------------------------------
 * متجر إلكتروني حقيقي (تجريبي) يتكامل مع بوابة الدفع Amana Pay عبر REST API
 * الموثّق في `docs/API.md`. لا يوجد أي تسجيل دخول للزبون — تصفّح، سلة، شراء فقط.
 */
'use strict';

const env = process.env;

// يقبل AMANA_PAY_URL مع أو بدون بروتوكول (Render fromService يعطي hostname فقط)،
// فنضيف https:// تلقائياً إن لزم لضمان روابط صحيحة (fetch + payment page URL).
function normalizeUrl(raw) {
  const v = (raw || 'http://localhost:4000').trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

module.exports = {
  port: Number(env.PORT || 5050),
  // عنوان خادم بوابة الدفع Amana Pay (يجب أن يكون يعمل قبل هذا المتجر)
  amanaPayUrl: normalizeUrl(env.AMANA_PAY_URL),
  // بيانات تسجيل المتجر لدى Amana Pay (auto-lookup عبر Accounts API)
  merchant: {
    name: 'Nova Gadgets',
    name_ar: 'نوفا غادجتس',
    email: env.STORE_EMAIL || 'store@novagadgets.jo',
    lookupValue: env.STORE_ACCOUNT_ID || 'acc_demo_002',
    lookupSchema: 'accountId',
    nid: '9990001',
  },
  currency: 'JOD',
};
