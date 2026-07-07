/**
 * Amana Pay — Application Server (Phase 1 infrastructure)
 * -----------------------------------------------------------------------------
 * Express + HTTP + WebSocket. يهيّئ قاعدة البيانات، يقدّم الواجهات الثابتة،
 * ويعرض نقاط صحّة. مسارات الأعمال (/api/v1/*) تُضاف في المرحلة 4.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');

const config = require('./config/config');
const db = require('./database/db');
const realtime = require('./realtime');
const poller = require('./services/polling.service');
const { requireApiKey } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/error-handler');

// تهيئة قاعدة البيانات (إنشاء الجداول إن لم تكن موجودة)
db.connect();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS: يسمح لمتاجر خارجية (مثل متجر العرض التوضيحي على منفذ مختلف)
// باستدعاء REST API الخاص بأمانة باي من متصفح العميل مباشرة.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// تسجيل بسيط للطلبات في وضع التطوير
if (config.server.nodeEnv !== 'production') {
  app.use((req, _res, next) => {
    // eslint-disable-next-line no-console
    console.log(`[req] ${req.method} ${req.url}`);
    next();
  });
}

// -----------------------------------------------------------------------------
// نقاط الصحّة والمعلومات
// -----------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'amana-pay',
    mode: config.jopacc.mode,
    time: new Date().toISOString(),
    wsClients: realtime.clientCount(),
  });
});

// نقطة معلومات تكشف مرجع SDK المُحمّل (للتأكد من ربط الإعدادات بالمواصفات)
app.get('/api/v1/info', (_req, res) => {
  res.json({
    service: 'amana-pay',
    jopacc: {
      mode: config.jopacc.mode,
      versions: config.jopacc.versions,
      apis: Object.keys(config.jopacc.baseUrls),
      crypto: config.jopacc.crypto,
      requiredHeaders: config.jopacc.requiredHeaders,
    },
    matching: { thresholds: config.matching.thresholds },
    billing: { model: 'saas_tiered', defaultPlan: config.billing.defaultPlan, plans: Object.values(config.billing.plans) },
    consent: { validityDays: config.consent.validityDays },
  });
});

// نقطة محمية للتحقق من مصادقة التاجر (تُستخدم لاحقاً؛ مفيدة للاختبار الآن)
app.get('/api/v1/ping', requireApiKey, (req, res) => {
  res.json({ ok: true, merchant: { id: req.merchant.id, name: req.merchant.name } });
});

// -----------------------------------------------------------------------------
// تقديم الواجهات الثابتة (إن وُجدت)
// -----------------------------------------------------------------------------
if (fs.existsSync(config.server.frontendDir)) {
  app.use('/', express.static(config.server.frontendDir));
}

// مسارات الأعمال
app.use('/api/v1', require('./routes/api.routes'));
app.use('/api/v1', require('./routes/payment-page.routes'));
app.use('/api/v1', require('./routes/dashboard.routes'));
app.use('/api/v1', require('./routes/demo.routes'));

// معالجات النهاية
app.use(notFound);
app.use(errorHandler);

// -----------------------------------------------------------------------------
// إقلاع الخادم + WebSocket
// -----------------------------------------------------------------------------
const httpServer = http.createServer(app);
realtime.attach(httpServer);

function start() {
  httpServer.listen(config.server.port, config.server.host, () => {
    const url = `http://localhost:${config.server.port}`;
    // eslint-disable-next-line no-console
    console.log(`\n  Amana Pay backend running`);
    // eslint-disable-next-line no-console
    console.log(`  → HTTP:   ${url}`);
    // eslint-disable-next-line no-console
    console.log(`  → WS:     ws://localhost:${config.server.port}/ws`);
    // eslint-disable-next-line no-console
    console.log(`  → Health: ${url}/health`);
    // eslint-disable-next-line no-console
    console.log(`  → Mode:   JoPACC ${config.jopacc.mode}\n`);
    // تشغيل بوّاب الاستطلاع (Balances + Transactions)
    poller.start();
  });
}

// إيقاف نظيف
function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`\n[amana-pay] ${signal} received, shutting down...`);
  httpServer.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

if (require.main === module) start();

module.exports = { app, httpServer, start };
