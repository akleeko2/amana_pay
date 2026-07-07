/**
 * Amana Pay — Consent Service
 * -----------------------------------------------------------------------------
 * يدير موافقة العميل (AIS) طويلة الأمد القابلة لإعادة الاستخدام عبر كل المتاجر:
 *  - initiate: بدء تدفق OAuth (مرة واحدة)
 *  - authorize: بعد موافقة العميل في بنكه → جلب IBAN/الاسم + حفظ دائم
 *  - findReusable: استرجاع موافقة سارية صامتاً (العميل العائد)
 *
 * مرتبطة بالعميل (phone) تجاه Amana Pay كـ TPP — ليست لكل متجر ولا لكل عملية.
 */
'use strict';

const crypto = require('crypto');
const sdk = require('../jopacc-sdk');
const db = require('../database/db');
const config = require('../config/config');
const { nowIso } = require('./_util');

/** بدء تدفق الموافقة للعميل (يُرجع redirectUrl + consentId). */
function initiate(phone) {
  const init = sdk.consent.initiateConsent(phone, config.consent.permissions, config.consent.validityDays);
  db.audit.log({ entityType: 'consent', entityId: init.consentId, action: 'initiated', details: JSON.stringify({ phone }) });
  return init;
}

/**
 * إتمام الموافقة: محاكاة موافقة العميل → جلب الحساب + الاسم + حفظ دائم.
 * @returns {object} سجل موافقة محفوظ (قابل لإعادة الاستخدام).
 */
async function authorize(consentId, phone) {
  const authd = sdk.consent.authorizeConsent(consentId);
  if (!authd) {
    const e = new Error('Consent غير موجود');
    e.status = 404;
    e.code = 'consent.not_found';
    throw e;
  }

  // جلب حساب العميل عبر CLIQ (phone) — IBAN + accountId
  const { account } = await sdk.accounts.getAccount(phone, 'CLIQ');
  const ibanRoute = account.routings.find((r) => r.schema === 'IBAN') || account.mainRoute;

  // الاسم من IBAN Confirmation
  const { result: ibanRes } = await sdk.iban.confirmIBAN({
    accountId: ibanRoute.address,
    accountType: account.accountType.code,
    uidType: 'NID',
    uidValue: '0000',
  });

  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + config.consent.validityDays * 86400000).toISOString();
  const row = {
    id,
    phone,
    account_id: account.accountId,
    iban: ibanRoute.address,
    customer_name: ibanRes.accountOwner.name.enName,
    bank_bic: account.institutionBasicInfo.institutionIdentification.address,
    permissions: JSON.stringify(config.consent.permissions),
    access_token: authd.accessToken,
    status: 'authorized',
    authorized_at: nowIso(),
    expires_at: expiresAt,
  };
  db.insert('customer_consents', row);
  db.audit.log({ entityType: 'consent', entityId: id, action: 'authorized', details: JSON.stringify({ phone, accountId: account.accountId }), jopaccApi: 'Accounts + IBAN Confirmation' });

  return db.customerConsents.findById(id);
}

/** استرجاع موافقة سارية محفوظة للعميل (العائد) — إعادة استخدام صامت. */
function findReusable(phone) {
  return db.customerConsents.findReusableByPhone(phone);
}

/** بناء "Payment Identity" المتوقعة من موافقة محفوظة (لوضع Verified). */
function identityFromConsent(consent) {
  if (!consent) return null;
  return {
    expected_debtor_phone: consent.phone,
    expected_debtor_account_id: consent.account_id,
    expected_debtor_iban: consent.iban,
    expected_debtor_name: consent.customer_name,
  };
}

/** التحقق من رصيد العميل (CAF) — يُستخدم في وضع Verified قبل عرض صفحة الدفع. */
async function checkCustomerFunds(consent, amount) {
  if (!consent) return null;
  const { result } = await sdk.caf.checkFunds(consent.account_id, amount, config.payments.currency, { accessToken: consent.access_token });
  return result; // { fundsAvailable, validityDateTime, instructionAmount }
}

module.exports = { initiate, authorize, findReusable, identityFromConsent, checkCustomerFunds };
