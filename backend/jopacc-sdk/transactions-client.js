/**
 * Amana Pay — Mock Transactions Client
 * -----------------------------------------------------------------------------
 * يحاكي Transactions API المستقبلي (غير منشور كـ API منفصل بعد، لكن نماذجه
 * debtor/creditor وروابطه HATEOAS موجودة في Accounts/IBANConfirmation).
 *
 *   listTransactions(accountId, {fromDate,toDate})
 *   getTransaction(accountId, transactionId)
 *   injectTransaction(accountId, tx)   ← للديمو (محاكاة دفعة واردة)
 *
 * بنية المعاملة تعكس debtorComplexType/creditorComplexType.
 */
'use strict';

const crypto = require('crypto');
const store = require('./_store');
const jades = require('./jades-client');
const { buildHeaders, errors } = require('./_helpers');

/** صياغة معاملة بشكل العقد (debtorAccount/creditorAccount مسطّحة للمطابقة). */
function toTransactionSchema(tx) {
  return {
    transactionId: tx.transactionId,
    amount: tx.amount,
    currency: tx.currency || 'JOD',
    reference: tx.reference || null,
    transactionType: tx.transactionType || 'CliQ_CREDIT',
    status: tx.status || 'completed',
    debtorAccount: tx.debtor?.iban || null,
    debtorName: tx.debtor?.name || null,
    debtorAgent: tx.debtor?.bic || null,
    creditorAccount: tx.creditor?.iban || null,
    creditorName: tx.creditor?.name || null,
    bankTimestamp: tx.bankTimestamp,
    _links: { account: { href: `/accounts/${tx.accountId}`, method: 'GET' } },
  };
}

async function listTransactions(accountId, { fromDate, toDate } = {}, opts = {}) {
  if (!store.getAccountById(accountId)) throw errors.notFound(`Account not found: ${accountId}`);
  let txs = store.listTransactions(accountId);
  if (fromDate) txs = txs.filter((t) => new Date(t.bankTimestamp) >= new Date(fromDate));
  if (toDate) txs = txs.filter((t) => new Date(t.bankTimestamp) <= new Date(toDate));

  return {
    headers: buildHeaders({ accessToken: opts.accessToken, jwsSignature: jades.sign({ accountId })['x-jws-signature'] }),
    data: txs.map(toTransactionSchema),
    _links: { self: { href: `/accounts/${accountId}/transactions`, method: 'GET' } },
  };
}

async function getTransaction(accountId, transactionId, opts = {}) {
  const tx = store.listTransactions(accountId).find((t) => t.transactionId === transactionId);
  if (!tx) throw errors.notFound(`Transaction not found: ${transactionId}`);
  return {
    headers: buildHeaders({ accessToken: opts.accessToken, jwsSignature: jades.sign({ transactionId })['x-jws-signature'] }),
    transaction: toTransactionSchema(tx),
  };
}

/**
 * حقن معاملة واردة (للديمو). يُنشئ معاملة CliQ_CREDIT لحساب التاجر.
 * لا يغيّر الرصيد هنا (يتكفّل demo.service بذلك عبر balances) لتبقى المسؤوليات منفصلة.
 */
function injectTransaction(accountId, { amount, reference, debtor, creditor, currency = 'JOD' }) {
  const tx = {
    transactionId: 'TXN-' + crypto.randomUUID(),
    accountId,
    amount,
    currency,
    reference,
    transactionType: 'CliQ_CREDIT',
    status: 'completed',
    debtor: debtor || {},
    creditor: creditor || {},
    bankTimestamp: new Date().toISOString(),
  };
  store.addTransaction(accountId, tx);
  return toTransactionSchema(tx);
}

module.exports = { listTransactions, getTransaction, injectTransaction, toTransactionSchema };
