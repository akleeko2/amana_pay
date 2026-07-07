/**
 * Amana Pay — Mock Accounts Client
 * -----------------------------------------------------------------------------
 * يحاكي Accounts API (v0.4.3):
 *   GET /accounts                  → { data: [account], _links }
 *   GET /accounts/{accountAddress} → account (header accountSchema: IBAN|accountId|CLIQ)
 *
 * ملاحظات مطابقة للمواصفة:
 *  - مخطط account لا يحتوي اسم صاحب الحساب (الاسم يُجلب من IBAN Confirmation).
 *  - routings[] يدعم CLIQ كقيمة schema (خرج). accountType.code مثل CHK.BUS.
 *  - schema=CLIQ كقيمة استعلام: استنتاجي (مدعوم هنا مع التنويه).
 */
'use strict';

const store = require('./_store');
const jades = require('./jades-client');
const { buildHeaders, errors } = require('./_helpers');

/** تحويل سجل المخزن الداخلي إلى مخطط account كما في OpenAPI. */
function toAccountSchema(a) {
  const bank = store.getBankByBic(a.institution.bic);
  return {
    accountId: a.accountId,
    accountCurrency: a.accountCurrency,
    accountHolderType: a.accountHolderType,
    accountStatus: a.accountStatus,
    accountType: a.accountType, // { code: 'CHK.BUS', name: '...' }
    availableBalance: {
      balanceAmount: a.balance.available,
      balancePosition: 'credit',
    },
    institutionBasicInfo: {
      institutionType: 'BANK',
      institutionIdentification: { address: a.institution.bic, schema: 'bicCode' },
      name: bank ? { enName: bank.name.en, arName: bank.name.ar } : undefined,
    },
    lastModificationDateTime: a.lastModificationDate,
    lockedForCredit: a.lockedForCredit,
    lockedForDebit: a.lockedForDebit,
    mainRoute: a.mainRoute, // { address, schema: 'IBAN' }
    routings: a.routings, // includes CLIQ
    sharedAccount: false,
    _links: {
      self: { href: `/accounts/${a.accountId}`, method: 'GET' },
      balances: { href: `/accounts/${a.accountId}/balances`, method: 'GET' },
      transactions: { href: `/accounts/${a.accountId}/transactions`, method: 'GET' },
      institution: { href: '/institution', method: 'GET' },
    },
  };
}

/**
 * GET /accounts/{accountAddress}
 * @param {string} accountAddress - القيمة حسب accountSchema
 * @param {string} schema - 'IBAN' | 'accountId' | 'CLIQ' (افتراضي accountId)
 */
async function getAccount(accountAddress, schema = 'accountId', opts = {}) {
  const headers = buildHeaders({ accessToken: opts.accessToken, jwsSignature: jades.sign({ accountAddress, schema })['x-jws-signature'] });
  const acc = store.getAccountByAddress(accountAddress, schema);
  if (!acc) throw errors.notFound(`Account not found for ${schema}=${accountAddress}`);
  return { headers, account: toAccountSchema(acc) };
}

/** GET /accounts → قائمة الحسابات (مغلّفة بـ data + _links). */
async function listAccounts(opts = {}) {
  const accts = store.accounts.map(toAccountSchema);
  return {
    headers: buildHeaders({ accessToken: opts.accessToken, jwsSignature: jades.sign({ list: true })['x-jws-signature'] }),
    data: accts,
    _links: { self: { href: '/accounts', method: 'GET' } },
  };
}

/** مساعد داخلي: جلب السجل الخام (يُستخدم من clients أخرى). */
function _raw(accountAddress, schema) {
  return store.getAccountByAddress(accountAddress, schema);
}

module.exports = { getAccount, listAccounts, toAccountSchema, _raw };
