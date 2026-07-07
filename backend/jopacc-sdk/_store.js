/**
 * Amana Pay — Mock SDK Runtime Store
 * -----------------------------------------------------------------------------
 * يحمّل البيانات الوهمية من mock-data/ ويحتفظ بحالة قابلة للتغيير في الذاكرة
 * (أرصدة + معاملات) لتدعم محاكاة الدفع: تغيّر الرصيد وحقن المعاملات.
 *
 * كل clients الـ SDK تعمل على هذا المخزن المشترك.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'mock-data');
const load = (f) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));

const banks = load('banks.json');

// نسخ عميقة لتجنّب تعديل ملفات JSON الأصلية أثناء التشغيل
const accounts = load('accounts.json').map((a) => ({
  ...a,
  balance: { ...a.balance },
  lastModificationDate: new Date('2026-06-01T00:00:00Z').toISOString(),
}));

// المعاملات لكل حساب: { [accountId]: Transaction[] }
const transactionsByAccount = {};
for (const tx of load('transactions.json')) {
  (transactionsByAccount[tx.accountId] ||= []).push({ ...tx });
}

const fees = load('fees.json');

// فهارس مساعدة
const bankByBic = new Map(banks.map((b) => [b.bic, b]));

function findAccount(predicate) {
  return accounts.find(predicate);
}

function getAccountById(accountId) {
  return findAccount((a) => a.accountId === accountId);
}

/** البحث عن حساب بأي نمط routing (IBAN / accountId / CLIQ) أو الهاتف. */
function getAccountByAddress(address, schema) {
  const s = (schema || '').toUpperCase();
  return findAccount((a) => {
    if (s === 'ACCOUNTID') return a.accountId === address;
    if (s === 'IBAN') return a.mainRoute.address === address || a.routings.some((r) => r.schema === 'IBAN' && r.address === address);
    if (s === 'CLIQ') return a.routings.some((r) => r.schema === 'CLIQ' && r.address === address);
    // بدون schema: جرّب كل الاحتمالات + الهاتف
    return (
      a.accountId === address ||
      a.phone === address ||
      a.mainRoute.address === address ||
      a.routings.some((r) => r.address === address)
    );
  });
}

function getBankByBic(bic) {
  return bankByBic.get(bic) || null;
}

/** تحديث رصيد حساب (يحاكي وصول/خروج أموال) + تحديث lastModificationDate. */
function applyBalanceDelta(accountId, delta) {
  const acc = getAccountById(accountId);
  if (!acc) return null;
  acc.balance.available = Number((acc.balance.available + delta).toFixed(3));
  acc.balance.current = Number((acc.balance.current + delta).toFixed(3));
  acc.lastModificationDate = new Date().toISOString();
  return acc;
}

function listTransactions(accountId) {
  return transactionsByAccount[accountId] || [];
}

function addTransaction(accountId, tx) {
  (transactionsByAccount[accountId] ||= []).push(tx);
  return tx;
}

module.exports = {
  banks,
  accounts,
  fees,
  getAccountById,
  getAccountByAddress,
  getBankByBic,
  applyBalanceDelta,
  listTransactions,
  addTransaction,
};
