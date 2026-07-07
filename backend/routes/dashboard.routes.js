/**
 * Amana Pay — Dashboard API (/api/v1/dashboard)
 * -----------------------------------------------------------------------------
 * بيانات لوحة تحكم التاجر (محمية بمفتاح API): نظرة عامة، رسم 7 أيام،
 * حالة الربط مع Open Finance، وملخص الفوترة الشهري.
 */
'use strict';

const express = require('express');
const { requireApiKey } = require('../middleware/auth');
const paymentService = require('../services/payment.service');
const billing = require('../services/billing.service');
const merchantService = require('../services/merchant.service');
const db = require('../database/db');
const config = require('../config/config');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/v1/dashboard/overview — بطاقات + آخر المدفوعات + حالة الربط
router.get(
  '/dashboard/overview',
  requireApiKey,
  wrap(async (req, res) => {
    const m = req.merchant;
    const list = paymentService.listByMerchant(m.id);
    const count = (s) => list.filter((p) => p.status === s).length;
    const confirmedVolume = list
      .filter((p) => p.status === 'CONFIRMED')
      .reduce((sum, p) => sum + p.original_amount, 0);

    res.json({
      cards: {
        total: list.length,
        confirmed: count('CONFIRMED'),
        pending: count('PENDING') + count('PROCESSING'),
        expired: count('EXPIRED'),
        cancelled: count('CANCELLED'),
        confirmedVolume: Number(confirmedVolume.toFixed(3)),
      },
      recentPayments: list.slice(0, 10).map(paymentService.paymentPageView),
      openFinance: {
        connected: m.account_status === 'active' && !m.locked_for_credit,
        accountStatus: m.account_status,
        acceptsCredit: !m.locked_for_credit,
        bankName: m.bank_name,
        bankBic: m.bank_bic,
        lastBalanceCheck: m.last_balance_check,
        lastKnownBalance: m.last_known_balance,
        mode: config.jopacc.mode,
      },
      billing: billing.monthlySummary(m),
      plan: m.plan || config.billing.defaultPlan,
    });
  })
);

// GET /api/v1/dashboard/chart?days=7 — سلسلة زمنية للمدفوعات
router.get(
  '/dashboard/chart',
  requireApiKey,
  wrap(async (req, res) => {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
    const list = paymentService.listByMerchant(req.merchant.id);
    const buckets = {};
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      buckets[d] = { date: d, count: 0, confirmed: 0, volume: 0 };
    }
    for (const p of list) {
      const d = String(p.created_at).slice(0, 10);
      if (buckets[d]) {
        buckets[d].count += 1;
        if (p.status === 'CONFIRMED') {
          buckets[d].confirmed += 1;
          buckets[d].volume = Number((buckets[d].volume + p.original_amount).toFixed(3));
        }
      }
    }
    res.json({ series: Object.values(buckets) });
  })
);

// GET /api/v1/dashboard/transactions — سجل المعاملات مع تفاصيل المطابقة
router.get(
  '/dashboard/transactions',
  requireApiKey,
  wrap(async (req, res) => {
    const txs = db.transactions.listByMerchant(req.merchant.id).map((t) => ({
      ...t,
      match_factors: t.match_factors ? JSON.parse(t.match_factors) : [],
    }));
    res.json({ transactions: txs });
  })
);

// GET /api/v1/dashboard/settings — إعدادات التاجر (حالة الحساب + Webhook + Consent)
router.get(
  '/dashboard/settings',
  requireApiKey,
  wrap(async (req, res) => {
    const m = req.merchant;
    res.json({
      merchant: merchantService.publicView(m),
      account: {
        iban: m.iban,
        cliqAlias: m.cliq_alias,
        bankName: m.bank_name,
        accountType: m.account_type_code,
        accountStatus: m.account_status,
        lockedForCredit: !!m.locked_for_credit,
      },
      webhook: { url: m.webhook_url },
      consent: { status: m.consent_status, expiresAt: m.consent_expires_at },
    });
  })
);

module.exports = router;
