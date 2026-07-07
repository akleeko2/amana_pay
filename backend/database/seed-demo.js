/**
 * Amana Pay — Demo Seed (presentation-ready scenario)
 * -----------------------------------------------------------------------------
 * يهيّئ سيناريو عرض كامل عبر الخدمات الحقيقية:
 *  - تاجر "Downtown Computers" مربوط عبر Open Finance (Accounts + IBAN Confirmation)
 *  - طلب دفع معلّق (Express) جاهز للمعاينة
 *  - موافقة عميل سارية (0791234567) لإظهار مسار Verified بصفر redirect
 * ويطبع الروابط الجاهزة للمقدّم.
 *
 * التشغيل:  node database/seed-demo.js
 */
'use strict';

const db = require('./db');
const merchantService = require('../services/merchant.service');
const paymentService = require('../services/payment.service');
const consentService = require('../services/consent.service');

async function run() {
  db.connect();

  const email = 'demo-merchant@amanapay.jo';
  let merchant = db.merchants.findByEmail(email);
  if (!merchant) {
    merchant = await merchantService.register({
      name: 'Downtown Computers',
      name_ar: 'داون تاون للحاسوب',
      email,
      lookupValue: 'acc_demo_001',
      lookupSchema: 'accountId',
      webhook_url: '',
    });
  }

  // طلب دفع معلّق للمعاينة (Express)
  const payment = await paymentService.createPayment(merchant, {
    originalAmount: 10,
    orderId: 'DEMO-ORDER-1',
    description: 'Demo product',
  });

  // موافقة عميل سارية (لمسار Verified / العائد)
  const phone = '0791234567';
  if (!consentService.findReusable(phone)) {
    const init = consentService.initiate(phone);
    await consentService.authorize(init.consentId, phone);
  }

  const port = require('../config/config').server.port;
  const base = `http://localhost:${port}`;
  /* eslint-disable no-console */
  console.log('\n=== Amana Pay — Demo seed ready ===');
  console.log('Landing      :', `${base}/index.html`);
  console.log('Dashboard    :', `${base}/dashboard/index.html`);
  console.log('Merchant     :', merchant.name, `(${merchant.bank_name})`);
  console.log('API Key      :', merchant.api_key);
  console.log('Payment link :', `${base}/payment-page/index.html?id=${payment.id}`);
  console.log('  reference  :', payment.reference, '| amount:', payment.dynamic_amount, 'JOD');
  console.log('Verified phone:', phone, '(consent active — returning-customer flow)');
  console.log('===================================\n');
  /* eslint-enable no-console */

  db.close();
}

run().catch((e) => {
  console.error('[seed-demo] error:', e);
  db.close();
  process.exit(1);
});
