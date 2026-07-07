/**
 * Amana Pay — JoPACC SDK Entry Point
 * -----------------------------------------------------------------------------
 * نقطة دخول موحّدة تُصدّر كل clients. الخدمات (المرحلة 3+) تستورد من هنا فقط،
 * بحيث يكفي تبديل التنفيذ (mock → live) دون تغيير المستهلكين.
 *
 * مرجع العقود: sdks/jopacc-open-finance/openapi-specs/*.json
 */
'use strict';

const config = require('../config/config');

const auth = require('./auth-client');
const jades = require('./jades-client');
const jwe = require('./jwe-client');
const accounts = require('./accounts-client');
const balances = require('./balances-client');
const transactions = require('./transactions-client');
const caf = require('./caf-client');
const iban = require('./iban-client');
const fees = require('./fees-client');
const consent = require('./consent-client');
const institutions = require('./institutions-client');
const store = require('./_store');

module.exports = {
  mode: config.jopacc.mode,
  auth,
  jades,
  jwe,
  accounts,
  balances,
  transactions,
  caf,
  iban,
  fees,
  consent,
  institutions,
  // مخزن البيانات الوهمية (للديمو فقط: تغيير الرصيد/حقن المعاملات)
  _store: store,
};
