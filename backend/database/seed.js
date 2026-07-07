/**
 * Amana Pay — Dev Seed (Phase 1 verification helper)
 * -----------------------------------------------------------------------------
 * يُدخل تاجراً تجريبياً واحداً للتحقق من طبقة قاعدة البيانات والمصادقة.
 * بيانات الحساب تحاكي ما ستجلبه Accounts API + IBAN Confirmation لاحقاً.
 *
 * التشغيل:  node database/seed.js
 */
'use strict';

const crypto = require('crypto');
const { randomUUID } = crypto;
const db = require('./db');

function seed() {
  db.connect();

  const email = 'demo@amanapay.jo';
  const existing = db.merchants.findByEmail(email);
  if (existing) {
    // eslint-disable-next-line no-console
    console.log('[seed] التاجر التجريبي موجود مسبقاً. API key:', existing.api_key);
    return existing;
  }

  const id = randomUUID();
  const apiKey = 'ak_' + crypto.randomBytes(16).toString('hex');
  const apiSecret = 'sk_' + crypto.randomBytes(24).toString('hex');

  db.run(
    `INSERT INTO merchants (
       id, name, name_ar, email, api_key, api_secret,
       bank_name, bank_name_ar, bank_bic, cliq_alias,
       account_name, account_name_ar, iban, jopacc_account_id,
       account_type_code, account_holder_type, account_status, locked_for_credit,
       webhook_url, status
     ) VALUES (?,?,?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?)`,
    [
      id, 'Downtown Computers', 'داون تاون للحاسوب', email, apiKey, apiSecret,
      'Arab Bank', 'البنك العربي', 'ARABJOAX', 'DOWNTOWN',
      'Downtown Computers', 'داون تاون للحاسوب', 'JO94CBJO0010000000000131000302', 'acc_demo_001',
      'CHK.BUS', 'corporate', 'active', 0,
      'https://example.com/webhooks/amana', 'active',
    ]
  );

  db.audit.log({ merchantId: id, entityType: 'merchant', entityId: id, action: 'created', details: '{"source":"seed"}' });

  const merchant = db.merchants.findById(id);
  // eslint-disable-next-line no-console
  console.log('[seed] تم إنشاء تاجر تجريبي:');
  // eslint-disable-next-line no-console
  console.log('       id     :', merchant.id);
  // eslint-disable-next-line no-console
  console.log('       api_key:', merchant.api_key);
  return merchant;
}

if (require.main === module) {
  seed();
  db.close();
}

module.exports = { seed };
