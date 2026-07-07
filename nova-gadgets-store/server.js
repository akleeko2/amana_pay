/**
 * Nova Gadgets — متجر إلكتروني تجريبي حقيقي
 * -----------------------------------------------------------------------------
 * خادم Express مستقل تماماً عن Amana Pay، يمثّل "متجراً خارجياً" حقيقياً
 * يدمج بوابة الدفع Amana Pay عبر REST API الموثّق (docs/API.md):
 *   1) يسجّل نفسه كتاجر لدى Amana Pay (auto-lookup عبر Accounts API) عند الإقلاع.
 *   2) يعرض كتالوج منتجات وسلة تسوّق بلا أي تسجيل دخول للزبون.
 *   3) عند الشراء، ينشئ طلب دفع حقيقياً لدى Amana Pay ويحوّل الزبون لصفحة
 *      الدفع الحقيقية (CliQ) ليتابع الدفع، ثم يستقبل التأكيد عبر Webhook/Polling.
 *
 * التشغيل: يجب أن يكون خادم Amana Pay (backend/server.js) يعمل مسبقاً
 * على المنفذ 4000، لأن هذا المتجر يستهلك REST API حقيقي منه.
 */
'use strict';

const http = require('http');
const path = require('path');
const express = require('express');

const config = require('./config');
const cookies = require('./lib/cookies');
const amana = require('./lib/amana-client');
const storeRoutes = require('./routes/store.routes');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true); // خلف بروكسي Render: req.protocol = https لرابط العودة الصحيح
app.use(express.json({ limit: '512kb' }));
app.use(cookies);

app.use('/api', storeRoutes);

// الواجهة الأمامية الثابتة (بلا أي إطار عمل)
app.use('/', express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'nova-gadgets-store' }));

// معالج أخطاء — يسجّل تفاصيل كافية لتشخيص فشل الاتصال بالبوابة في لوق السحابة
app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(
    '[nova-gadgets] error:',
    err.message,
    '| status:', err.status || '-',
    '| amanaPayUrl:', config.amanaPayUrl,
    '| data:', err.data ? JSON.stringify(err.data) : '-',
    err.cause ? '| cause: ' + (err.cause.message || err.cause) : ''
  );
  res.status(err.status || 500).json({
    error: err.message || 'internal_error',
    amanaPayUrl: config.amanaPayUrl,
    detail: err.data || null,
  });
});

const server = http.createServer(app);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * التسجيل لدى Amana Pay مع إعادة محاولة — مهم على السحابة حيث قد يقلع المتجر
 * قبل أن يجهز خادم Amana Pay (cold start). لا نُسقط العملية عند الفشل المؤقت.
 */
async function registerWithRetry(maxAttempts = 20, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await amana.ensureRegistered();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`  … محاولة التسجيل ${attempt}/${maxAttempts} فشلت (${e.message})`);
      if (attempt < maxAttempts) await sleep(delayMs);
    }
  }
  return null;
}

async function start() {
  // eslint-disable-next-line no-console
  console.log('\n  Nova Gadgets — الإقلاع...');
  const reg = await registerWithRetry();
  if (reg) {
    const { merchant, apiKey, freshlyRegistered } = reg;
    // eslint-disable-next-line no-console
    console.log(`  → مسجَّل لدى Amana Pay: ${merchant.name} (${merchant.bank_name})`);
    // eslint-disable-next-line no-console
    console.log(`  → IBAN: ${merchant.iban}  |  CliQ: ${merchant.cliq_alias || '—'}`);
    // eslint-disable-next-line no-console
    console.log(`  → API Key ${freshlyRegistered ? '(جديد)' : '(من البيئة)'}: ${apiKey}`);
  } else {
    // نبدأ الخادم رغم ذلك (الكتالوج يعمل)؛ الدفع سيُحاول التسجيل عند أول طلب.
    // eslint-disable-next-line no-console
    console.error('  ✗ تعذّر التسجيل لدى Amana Pay بعد عدة محاولات:', config.amanaPayUrl);
    // eslint-disable-next-line no-console
    console.error('  ✗ سيبدأ المتجر والكتالوج، لكن الدفع لن يعمل حتى يتوفّر Amana Pay.');
  }

  server.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`\n  Nova Gadgets store running`);
    // eslint-disable-next-line no-console
    console.log(`  → Store:  http://localhost:${config.port}`);
    // eslint-disable-next-line no-console
    console.log(`  → Amana Pay backend: ${config.amanaPayUrl}\n`);
  });
}

function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`\n[nova-gadgets] ${signal} received, shutting down...`);
  server.close(() => process.exit(0));
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

if (require.main === module) start();

module.exports = { app, server, start };
