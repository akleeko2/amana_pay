/**
 * Amana Pay — Demo API (/api/v1/demo)
 * -----------------------------------------------------------------------------
 * نقاط محاكاة العرض التقديمي. متاحة بلا مفتاح API لتسهيل العرض،
 * وتعمل فقط في وضع JoPACC = mock (تُرفض في وضع live).
 */
'use strict';

const express = require('express');
const demoService = require('../services/demo.service');
const config = require('../config/config');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function ensureMock(_req, _res, next) {
  if (config.jopacc.mode !== 'mock') {
    const e = new Error('نقاط الديمو متاحة في وضع mock فقط');
    e.status = 403;
    e.code = 'demo.disabled';
    return next(e);
  }
  next();
}

// POST /api/v1/demo/simulate-payment/:paymentId — محاكاة دفع CliQ
router.post(
  '/demo/simulate-payment/:paymentId',
  ensureMock,
  wrap(async (req, res) => {
    const { fromIban, fromName, fromBic, useReference, exactAmount } = req.body || {};
    const result = await demoService.simulatePayment(req.params.paymentId, {
      fromIban,
      fromName,
      fromBic,
      useReference,
      exactAmount,
    });
    res.json({
      ok: true,
      payment: require('../services/payment.service').paymentPageView(result.payment),
      injectedTransaction: result.injectedTransaction,
      pollResult: result.pollResult,
    });
  })
);

module.exports = router;
