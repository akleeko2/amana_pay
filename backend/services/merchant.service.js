/**
 * Amana Pay — Merchant Service
 * -----------------------------------------------------------------------------
 * تسجيل التاجر مع auto-lookup لبيانات الحساب عبر Open Finance:
 *   - Accounts API: IBAN, accountType, accountStatus, البنك, routings (IBAN+CLIQ)
 *   - IBAN Confirmation: اسم صاحب الحساب (مخطط account لا يحتوي اسماً)
 * المعرّف المضمون IBAN/accountId؛ CliQ Alias خيار استنتاجي.
 */
'use strict';

const crypto = require('crypto');
const sdk = require('../jopacc-sdk');
const db = require('../database/db');
const verification = require('./verification.service');
const { nowIso } = require('./_util');

function genApiKey() {
  return 'ak_' + crypto.randomBytes(16).toString('hex');
}
function genApiSecret() {
  return 'sk_' + crypto.randomBytes(24).toString('hex');
}

/**
 * تسجيل تاجر جديد.
 * @param {object} p - { name, name_ar?, email, lookupValue, lookupSchema='accountId'|'IBAN'|'CLIQ', nid?, webhook_url? }
 */
async function register({ name, name_ar, email, lookupValue, lookupSchema = 'accountId', nid = '0000', webhook_url, plan, fixedApiKey }) {
  if (!name || !email || !lookupValue) {
    const e = new Error('الاسم والبريد ومعرّف الحساب مطلوبة');
    e.status = 400;
    e.code = 'merchant.invalid_input';
    throw e;
  }
  const config = require('../config/config');
  const planCode = config.billing.plans[plan] ? plan : config.billing.defaultPlan;
  const existing = db.merchants.findByEmail(email);
  if (existing) {
    // في وضع mock (البروتوتايب/الديمو السحابي): التسجيل idempotent —
    // نُعيد التاجر الحالي بمفتاحه بدل الفشل، ليتعافى المتجر تلقائياً بعد أي restart.
    if (config.jopacc.mode === 'mock') {
      return db.merchants.findById(existing.id);
    }
    const e = new Error('البريد الإلكتروني مستخدم مسبقاً');
    e.status = 409;
    e.code = 'merchant.email_exists';
    throw e;
  }

  // 1. Accounts API auto-lookup
  const { account } = await sdk.accounts.getAccount(lookupValue, lookupSchema);
  const ibanRoute = account.routings.find((r) => r.schema === 'IBAN') || account.mainRoute;
  const cliqRoute = account.routings.find((r) => r.schema === 'CLIQ');
  const bic = account.institutionBasicInfo.institutionIdentification.address;
  const bankName = account.institutionBasicInfo.name || {};

  // 2. التحقق + جلب الاسم من IBAN Confirmation
  const verif = await verification.verifyMerchantAccount({
    accountId: account.accountId,
    iban: ibanRoute.address,
    accountType: account.accountType.code,
    nid,
  });

  const id = crypto.randomUUID();
  // في وضع mock نسمح بمفتاح ثابت (لثبات المفتاح عبر إعادة التشغيل على السحابة)
  const apiKey = (config.jopacc.mode === 'mock' && fixedApiKey) ? fixedApiKey : genApiKey();
  const row = {
    id,
    name,
    name_ar: name_ar || verif.accountOwnerName.arName || null,
    email,
    api_key: apiKey,
    api_secret: genApiSecret(),
    bank_name: bankName.enName || null,
    bank_name_ar: bankName.arName || null,
    bank_bic: bic,
    cliq_alias: cliqRoute ? cliqRoute.address : null,
    account_name: verif.accountOwnerName.enName || null,
    account_name_ar: verif.accountOwnerName.arName || null,
    iban: ibanRoute.address,
    jopacc_account_id: account.accountId,
    account_type_code: account.accountType.code,
    account_holder_type: account.accountHolderType,
    account_status: verif.accountStatus,
    locked_for_credit: verif.lockedForCredit ? 1 : 0,
    last_known_balance: verif.currentBalance,
    last_balance_check: nowIso(),
    plan: planCode,
    webhook_url: webhook_url || null,
    webhook_secret: 'whsec_' + crypto.randomBytes(16).toString('hex'),
    status: 'active',
  };

  db.insert('merchants', row);
  db.audit.log({ merchantId: id, entityType: 'merchant', entityId: id, action: 'created', details: JSON.stringify({ via: lookupSchema }), jopaccApi: 'Accounts + IBAN Confirmation + Balances' });

  return db.merchants.findById(id);
}

/** تحقق من حساب التاجر (نقطة /merchants/verify). */
async function verify(merchant) {
  return verification.verifyMerchantAccount({
    accountId: merchant.jopacc_account_id,
    iban: merchant.iban,
    accountType: merchant.account_type_code || 'CHK.BUS',
  });
}

/** عرض آمن للتاجر (بدون أسرار). */
function publicView(m) {
  if (!m) return null;
  const { api_secret, webhook_secret, ...safe } = m;
  return safe;
}

/**
 * زرع تاجر ثابت بمفتاح ثابت عند الإقلاع (للنشر السحابي بقاعدة بيانات مؤقتة).
 * يُفعَّل عبر SEED_MERCHANT=true. المفتاح يبقى ثابتاً من SEED_MERCHANT_API_KEY،
 * فلا يتغيّر مع كل restart، ويظل الداش بورد والمتجر شغّالين بنفس المفتاح.
 */
async function ensureSeedMerchant() {
  const env = process.env;
  if (String(env.SEED_MERCHANT || '').toLowerCase() !== 'true') return null;

  const email = env.SEED_MERCHANT_EMAIL || 'store@novagadgets.jo';
  const existing = db.merchants.findByEmail(email);
  if (existing) return existing; // موجود مسبقاً (نفس المفتاح الثابت)

  return register({
    name: env.SEED_MERCHANT_NAME || 'Nova Gadgets',
    name_ar: env.SEED_MERCHANT_NAME_AR || 'نوفا غادجتس',
    email,
    lookupValue: env.SEED_MERCHANT_ACCOUNT || 'acc_demo_002',
    lookupSchema: 'accountId',
    plan: env.SEED_MERCHANT_PLAN || 'GROWTH',
    fixedApiKey: env.SEED_MERCHANT_API_KEY || undefined,
  });
}

module.exports = { register, verify, publicView, genApiKey, genApiSecret, ensureSeedMerchant };
