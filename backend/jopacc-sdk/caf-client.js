/**
 * Amana Pay — Mock CAF Client (Confirmation of Availability of Funds)
 * -----------------------------------------------------------------------------
 * يحاكي: POST /accounts/{accountId}/CAF
 * Request body: { instructionAmount: { amount, currency } }
 * Response: { fundsAvailable, validityDateTime, instructionAmount }
 */
'use strict';

const store = require('./_store');
const jades = require('./jades-client');
const { buildHeaders, errors } = require('./_helpers');

/**
 * التحقق من توفر الرصيد على حساب العميل قبل الدفع.
 * @param {string} accountId
 * @param {number} amount
 * @param {string} currency
 */
async function checkFunds(accountId, amount, currency = 'JOD', opts = {}) {
  const acc = store.getAccountById(accountId);
  if (!acc) throw errors.notFound(`Account not found: ${accountId}`);

  const body = { instructionAmount: { amount, currency } };
  const headers = buildHeaders({
    accessToken: opts.accessToken,
    jwsSignature: jades.sign(body)['x-jws-signature'],
  });

  const fundsAvailable = acc.balance.available >= amount;
  const validityDateTime = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // صالح 10 دقائق

  return {
    headers,
    result: {
      fundsAvailable,
      validityDateTime,
      instructionAmount: { amount, currency },
    },
  };
}

module.exports = { checkFunds };
