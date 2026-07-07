/**
 * Amana Pay — Mock Balances Client
 * -----------------------------------------------------------------------------
 * يحاكي Balances API: GET /accounts/{accountId}/balances
 * يرجع availableBalance + currentBalance (balanceAmount/balancePosition)
 * + balanceCurrency + lastModificationDate (أساس Balance Change Detection).
 */
'use strict';

const store = require('./_store');
const jades = require('./jades-client');
const { buildHeaders, errors } = require('./_helpers');

async function getBalance(accountId, opts = {}) {
  const acc = store.getAccountById(accountId);
  if (!acc) throw errors.notFound(`Account not found: ${accountId}`);

  const headers = buildHeaders({
    accessToken: opts.accessToken,
    jwsSignature: jades.sign({ accountId })['x-jws-signature'],
  });

  return {
    headers,
    balance: {
      availableBalance: { balanceAmount: acc.balance.available, balancePosition: 'credit' },
      currentBalance: { balanceAmount: acc.balance.current, balancePosition: 'credit' },
      balanceCurrency: acc.accountCurrency,
      lastModificationDate: acc.lastModificationDate,
      _links: {
        self: { href: `/accounts/${accountId}/balances`, method: 'GET' },
        account: { href: `/accounts/${accountId}`, method: 'GET' },
        institution: { href: '/institution', method: 'GET' },
      },
    },
  };
}

module.exports = { getBalance };
