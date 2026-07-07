/**
 * Amana Pay — Mock IBAN Confirmation Client
 * -----------------------------------------------------------------------------
 * يحاكي: GET /institution/ibanConf
 * هيدرات إدخال إلزامية: accountType, accountId, uidType, uidValue (+ الأمنية).
 * الاستجابة: status, lockedForCredit, lockedForDebit, currencies,
 *            accountOwner{name{enName,arName}, accountHolderType, address},
 *            institutionBasicInfo{...}, additionalInformation.
 *
 * ملاحظة: accountType هيدر إدخال — ولا يُرجَع في الاستجابة (نوع الحساب من Accounts API).
 */
'use strict';

const store = require('./_store');
const jades = require('./jades-client');
const { buildHeaders, errors } = require('./_helpers');

/**
 * @param {object} p
 * @param {string} p.accountId - معرّف/IBAN المستعلَم عنه
 * @param {string} p.accountType - هيدر إلزامي (نوع/مخطط الحساب)
 * @param {string} p.uidType - مثل NID
 * @param {string} p.uidValue
 */
async function confirmIBAN({ accountId, accountType, uidType, uidValue }, opts = {}) {
  if (!accountType) {
    throw errors.badRequest('Required header accountType is missing', [
      { code: 'http.headers.invalid', desc: 'Required header accountType is missing' },
    ]);
  }
  if (!uidType || !uidValue) {
    throw errors.badRequest('Required uid headers are missing');
  }

  // نبحث بالـ IBAN أو accountId
  const acc =
    store.getAccountByAddress(accountId, 'IBAN') ||
    store.getAccountByAddress(accountId, 'accountId');
  if (!acc) throw errors.notFound(`IBAN/account not found: ${accountId}`);

  const bank = store.getBankByBic(acc.institution.bic);
  const headers = buildHeaders({
    accessToken: opts.accessToken,
    jwsSignature: jades.sign({ accountId, accountType, uidType })['x-jws-signature'],
  });

  return {
    headers,
    result: {
      status: acc.accountStatus, // active/inactive
      currencies: [acc.accountCurrency],
      lockedForCredit: acc.lockedForCredit,
      lockedForDebit: acc.lockedForDebit,
      accountOwner: {
        name: { enName: acc.owner.enName, arName: acc.owner.arName },
        accountHolderType: acc.accountHolderType,
      },
      institutionBasicInfo: {
        institutionType: 'BANK',
        institutionIdentification: { address: acc.institution.bic, schema: 'bicCode' },
        name: bank ? { enName: bank.name.en, arName: bank.name.ar } : undefined,
      },
      additionalInformation: 'JOPACC verified',
    },
  };
}

module.exports = { confirmIBAN };
