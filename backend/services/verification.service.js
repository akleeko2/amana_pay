/**
 * Amana Pay — Pre-Payment Verification Service
 * -----------------------------------------------------------------------------
 * تحقق شامل من حساب التاجر قبل التسجيل/إنشاء الدفع:
 *  1. IBAN Confirmation → status + lockedForCredit + اسم صاحب الحساب + البنك
 *  2. Balances → تسجيل الرصيد الحالي كـ baseline
 *
 * المرجع: implementation_plan.md (المكون 2.5).
 */
'use strict';

const sdk = require('../jopacc-sdk');
const db = require('../database/db');

/**
 * يتحقق من حساب التاجر عبر IBAN Confirmation + Balances.
 * @returns {object} نتيجة التحقق (verified, accountStatus, acceptsCredit, ...)
 * @throws إذا كان الحساب غير فعّال أو لا يقبل تحويلات واردة.
 */
async function verifyMerchantAccount({ accountId, iban, accountType = 'CHK.BUS', nid = '0000' }) {
  // 1. IBAN Confirmation — accountType هيدر إلزامي
  const { result: ibanResult } = await sdk.iban.confirmIBAN({
    accountId: iban || accountId,
    accountType,
    uidType: 'NID',
    uidValue: nid,
  });

  if (ibanResult.status !== 'active') {
    const e = new Error('حساب التاجر غير فعّال');
    e.status = 422;
    e.code = 'merchant.account_inactive';
    throw e;
  }
  if (ibanResult.lockedForCredit) {
    const e = new Error('حساب التاجر لا يقبل تحويلات واردة');
    e.status = 422;
    e.code = 'merchant.locked_for_credit';
    throw e;
  }

  // 2. Balances — baseline
  const { balance } = await sdk.balances.getBalance(accountId);

  return {
    verified: true,
    accountStatus: ibanResult.status,
    acceptsCredit: !ibanResult.lockedForCredit,
    lockedForCredit: ibanResult.lockedForCredit,
    accountOwnerName: ibanResult.accountOwner.name, // { enName, arName }
    accountHolderType: ibanResult.accountOwner.accountHolderType,
    bankName: ibanResult.institutionBasicInfo.name,
    bankBic: ibanResult.institutionBasicInfo.institutionIdentification.address,
    currentBalance: balance.availableBalance.balanceAmount,
    lastModified: balance.lastModificationDate,
  };
}

/** فحص قبل إنشاء طلب الدفع: التأكد أن الحساب لا يزال يقبل تحويلات + الرصيد baseline. */
async function prePaymentCheck(merchant) {
  const result = await verifyMerchantAccount({
    accountId: merchant.jopacc_account_id,
    iban: merchant.iban,
    accountType: merchant.account_type_code || 'CHK.BUS',
  });
  db.audit.log({
    merchantId: merchant.id,
    entityType: 'merchant',
    entityId: merchant.id,
    action: 'pre_payment_check',
    details: JSON.stringify({ acceptsCredit: result.acceptsCredit, balance: result.currentBalance }),
    jopaccApi: 'IBAN Confirmation + Balances',
  });
  return result;
}

module.exports = { verifyMerchantAccount, prePaymentCheck };
